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
      activate2FA: jest.fn(),
    };
    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
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

  describe('verify2FAAndLogin', () => {
    it('returns a JWT when the OTP is valid', async () => {
      const user = {
        email: 'a@example.com',
        id: 1,
        role: { role_name: 'admin' },
        twoFactorAuthSecret: 'base32secret',
      } as User;

      (usersService.findOneByEmail as jest.Mock).mockResolvedValue(user);
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);
      (jwtService.sign as jest.Mock).mockReturnValue('jwt-token');

      const result = await service.verify2FAAndLogin('a@example.com', '123456');

      expect(result).toBe('jwt-token');
    });

    it('returns null when the OTP is invalid', async () => {
      (usersService.findOneByEmail as jest.Mock).mockResolvedValue({
        email: 'a@example.com',
        twoFactorAuthSecret: 'base32secret',
      } as User);
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      await expect(
        service.verify2FAAndLogin('a@example.com', '000000'),
      ).resolves.toBeNull();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('returns null for an unknown user or one without two-factor', async () => {
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      (usersService.findOneByEmail as jest.Mock).mockResolvedValue(null);
      await expect(
        service.verify2FAAndLogin('nobody@example.com', '123456'),
      ).resolves.toBeNull();

      (usersService.findOneByEmail as jest.Mock).mockResolvedValue({
        email: 'a@example.com',
        twoFactorAuthSecret: null,
      } as User);
      await expect(
        service.verify2FAAndLogin('a@example.com', '123456'),
      ).resolves.toBeNull();

      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('confirm2FA', () => {
    it('activates the pending secret when the first code is valid', async () => {
      (usersService.findOneByEmail as jest.Mock).mockResolvedValue({
        email: 'a@example.com',
        twoFactorAuthPendingSecret: 'pendingsecret',
      } as User);
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      await expect(service.confirm2FA('a@example.com', '123456')).resolves.toBe(
        true,
      );

      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'pendingsecret',
        encoding: 'base32',
        token: '123456',
      });
      expect(usersService.activate2FA).toHaveBeenCalledWith('a@example.com');
    });

    it('leaves two-factor untouched when the code is wrong', async () => {
      (usersService.findOneByEmail as jest.Mock).mockResolvedValue({
        email: 'a@example.com',
        twoFactorAuthPendingSecret: 'pendingsecret',
      } as User);
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      await expect(service.confirm2FA('a@example.com', '000000')).resolves.toBe(
        false,
      );
      expect(usersService.activate2FA).not.toHaveBeenCalled();
    });

    it('refuses when no secret is waiting for confirmation', async () => {
      (usersService.findOneByEmail as jest.Mock).mockResolvedValue({
        email: 'a@example.com',
        twoFactorAuthPendingSecret: null,
      } as User);
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      await expect(service.confirm2FA('a@example.com', '123456')).resolves.toBe(
        false,
      );
      expect(usersService.activate2FA).not.toHaveBeenCalled();
    });
  });

  describe('two-factor challenge', () => {
    const user = { email: 'a@example.com', id: 1 } as User;

    it('signs a short-lived, single-purpose token', () => {
      (jwtService.sign as jest.Mock).mockReturnValue('challenge-token');

      expect(service.createTwoFactorChallenge(user)).toBe('challenge-token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        { email: 'a@example.com', sub: 1, purpose: '2fa' },
        { expiresIn: '5m' },
      );
    });

    it('accepts a challenge issued for the same email', () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        email: 'a@example.com',
        purpose: '2fa',
      });

      expect(
        service.isValidTwoFactorChallenge('challenge-token', 'a@example.com'),
      ).toBe(true);
    });

    it('rejects a missing, foreign, expired or session token', () => {
      expect(
        service.isValidTwoFactorChallenge(undefined, 'a@example.com'),
      ).toBe(false);

      (jwtService.verify as jest.Mock).mockReturnValue({
        email: 'other@example.com',
        purpose: '2fa',
      });
      expect(
        service.isValidTwoFactorChallenge('challenge-token', 'a@example.com'),
      ).toBe(false);

      (jwtService.verify as jest.Mock).mockReturnValue({
        email: 'a@example.com',
        role: 'Pilote',
      });
      expect(
        service.isValidTwoFactorChallenge('session-token', 'a@example.com'),
      ).toBe(false);

      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('jwt expired');
      });
      expect(
        service.isValidTwoFactorChallenge('expired-token', 'a@example.com'),
      ).toBe(false);
    });
  });
});
