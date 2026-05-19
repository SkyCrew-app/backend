import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { User } from '../../users/entity/users.entity';

jest.mock('bcrypt');
jest.mock('speakeasy');
jest.mock('qrcode');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Partial<UsersService>;
  let jwtService: Partial<JwtService>;

  beforeEach(async () => {
    usersService = {
      findOneByEmail: jest.fn(),
      set2FASecret: jest.fn(),
    };
    jwtService = {
      sign: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('validateUser', () => {
    it('returns user when credentials are valid', async () => {
      const user = {
        email: 'a@example.com',
        password: 'hashed',
        twoFactorAuthSecret: null,
      } as User;
      (usersService.findOneByEmail as jest.Mock).mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('a@example.com', 'password');
      expect(result).toBe(user);
    });

    it('returns null if user not found', async () => {
      (usersService.findOneByEmail as jest.Mock).mockResolvedValue(null);
      const result = await service.validateUser('a@example.com', 'password');
      expect(result).toBeNull();
    });

    it('returns null if password is incorrect', async () => {
      const user = {
        email: 'a@example.com',
        password: 'hashed',
        twoFactorAuthSecret: null,
      } as User;
      (usersService.findOneByEmail as jest.Mock).mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('a@example.com', 'wrong');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('signs JWT with correct payload', async () => {
      const user = {
        email: 'a@example.com',
        id: 1,
        role: { role_name: 'admin' },
      } as User;
      (jwtService.sign as jest.Mock).mockReturnValue('jwt-token');

      const token = await service.login(user);
      expect(token).toBe('jwt-token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        { email: 'a@example.com', sub: 1, role: 'admin' },
        { expiresIn: '2h' },
      );
    });
  });

  describe('generate2FASecret', () => {
    it('generates secret, stores it and returns QR code URL', async () => {
      (speakeasy.generateSecret as jest.Mock).mockReturnValue({
        base32: 'base32secret',
        otpauth_url: 'otpauth://url',
      });
      (qrcode.toDataURL as jest.Mock).mockResolvedValue(
        'data:image/png;base64,QR',
      );

      const result = await service.generate2FASecret('a@example.com');
      expect(usersService.set2FASecret).toHaveBeenCalledWith(
        'a@example.com',
        'base32secret',
      );
      expect(result).toEqual({
        secret: 'base32secret',
        qrCodeUrl: 'data:image/png;base64,QR',
      });
    });
  });

  describe('verify2FACode', () => {
    it('verifies TOTP code correctly', async () => {
      const user = { twoFactorAuthSecret: 'base32secret' } as User;
      (usersService.findOneByEmail as jest.Mock).mockResolvedValue(user);
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      const isValid = await service.verify2FACode('a@example.com', '123456');
      expect(isValid).toBe(true);
    });
  });
});
