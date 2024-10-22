import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

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
      sign: jest.fn().mockReturnValue('test-token'),
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should validate user with correct credentials', async () => {
    const user = {
      email: 'test@example.com',
      password: 'hashedPassword',
    } as any;
    (usersService.findOneByEmail as jest.Mock).mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.validateUser('test@example.com', 'password');

    expect(usersService.findOneByEmail).toHaveBeenCalledWith(
      'test@example.com',
    );
    expect(bcrypt.compare).toHaveBeenCalledWith('password', 'hashedPassword');
    expect(result).toEqual(user);
  });

  it('should return null for invalid credentials', async () => {
    (usersService.findOneByEmail as jest.Mock).mockResolvedValue(null);

    const result = await service.validateUser(
      'invalid@example.com',
      'password',
    );

    expect(result).toBeNull();
  });

  it('should generate a JWT token on login', async () => {
    const user = { email: 'test@example.com', id: 1 } as any;

    const result = await service.login(user);

    expect(jwtService.sign).toHaveBeenCalledWith({
      email: 'test@example.com',
      sub: 1,
    });
    expect(result).toBe('test-token');
  });

  it('should generate 2FA secret and QR code', async () => {
    (speakeasy.generateSecret as jest.Mock).mockReturnValue({
      base32: 'secret-base32',
      otpauth_url: 'otpauth-url',
    });
    (qrcode.toDataURL as jest.Mock).mockResolvedValue('qr-code-url');

    const result = await service.generate2FASecret('test@example.com');

    expect(speakeasy.generateSecret).toHaveBeenCalledWith({
      name: 'SkyCrew (test@example.com)',
    });
    expect(usersService.set2FASecret).toHaveBeenCalledWith(
      'test@example.com',
      'secret-base32',
    );
    expect(result).toEqual({
      secret: 'secret-base32',
      qrCodeUrl: 'qr-code-url',
    });
  });

  it('should verify 2FA token', async () => {
    const user = { twoFactorAuthSecret: 'secret-base32' } as any;
    (usersService.findOneByEmail as jest.Mock).mockResolvedValue(user);
    (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

    const result = await service.verify2FACode('test@example.com', '123456');

    expect(speakeasy.totp.verify).toHaveBeenCalledWith({
      secret: 'secret-base32',
      encoding: 'base32',
      token: '123456',
    });
    expect(result).toBe(true);
  });
});
