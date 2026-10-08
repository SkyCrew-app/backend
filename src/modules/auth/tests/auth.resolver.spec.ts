import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from '../auth.resolver';
import { AuthService } from '../auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { Response, Request } from 'express';

describe('AuthResolver', () => {
  let resolver: AuthResolver;
  let authService: Partial<AuthService>;
  let mockRes: Partial<Response>;
  let mockReq: Partial<Request>;

  beforeEach(async () => {
    authService = {
      validateUser: jest.fn(),
      login: jest.fn(),
      generate2FASecret: jest.fn(),
      verify2FACode: jest.fn(),
      verify2FAAndLogin: jest.fn(),
    };
    mockRes = { cookie: jest.fn(), clearCookie: jest.fn() };
    mockReq = { cookies: {} };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    resolver = module.get<AuthResolver>(AuthResolver);
  });

  describe('login', () => {
    it('throws UnauthorizedException with invalid credentials', async () => {
      (authService.validateUser as jest.Mock).mockResolvedValue(null);
      await expect(
        resolver.login(
          { email: 'a@example.com', password: 'wrong' },
          mockRes as Response,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('does not set auth token when 2FA is required', async () => {
      const user = {
        email: 'a@example.com',
        twoFactorAuthSecret: 'sec',
      } as any;
      (authService.validateUser as jest.Mock).mockResolvedValue(user);

      const response = await resolver.login(
        { email: 'a@example.com', password: 'pass' },
        mockRes as Response,
      );

      expect(mockRes.cookie).toHaveBeenCalledTimes(1);
      expect(mockRes.clearCookie).toHaveBeenCalledTimes(1);
      expect(response).toEqual({
        access_token: '',
        is2FAEnabled: true,
      });
    });
  });

  describe('getEmailFromCookie', () => {
    it('returns email when present', () => {
      mockReq.cookies = { email: 'test@example.com' };
      const email = resolver.getEmailFromCookie(mockReq as Request);
      expect(email).toBe('test@example.com');
    });

    it('throws error when missing', () => {
      mockReq.cookies = {};
      expect(() => resolver.getEmailFromCookie(mockReq as Request)).toThrow(
        'Aucun email trouvé dans les cookies',
      );
    });
  });

  describe('generate2FASecret', () => {
    it('returns the QR code URL', async () => {
      (authService.generate2FASecret as jest.Mock).mockResolvedValue({
        qrCodeUrl: 'url',
      });
      const url = await resolver.generate2FASecret('a@example.com');
      expect(url).toBe('url');
    });
  });

  describe('verify2FA', () => {
    it('sets auth token after successful 2FA verification', async () => {
      (authService.verify2FAAndLogin as jest.Mock).mockResolvedValue('jwt-token');
      const result = await resolver.verify2FA(
        'a@example.com',
        '123456',
        mockRes as Response,
      );

      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        access_token: 'jwt-token',
        is2FAEnabled: true,
      });
    });
  });

  describe('logout', () => {
    it('clears cookies and returns true', async () => {
      const result = await resolver.logout(mockRes as Response);
      expect(mockRes.clearCookie).toHaveBeenCalledTimes(2);
      expect(result).toBe(true);
    });
  });
});
