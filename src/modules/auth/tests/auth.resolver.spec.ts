import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from '../auth.resolver';
import { AuthService } from '../auth.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Response, Request } from 'express';
import { GqlThrottlerGuard } from '../../../common/guards/gql-throttler.guard';

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
      confirm2FA: jest.fn(),
      createTwoFactorChallenge: jest.fn().mockReturnValue('challenge-token'),
      isValidTwoFactorChallenge: jest.fn(),
    };
    mockRes = { cookie: jest.fn(), clearCookie: jest.fn() };
    mockReq = { cookies: {} };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        { provide: AuthService, useValue: authService },
      ],
    })
      .overrideGuard(GqlThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

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

      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'token',
        expect.any(Object),
      );
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'two_factor_challenge',
        'challenge-token',
        expect.objectContaining({ httpOnly: true, maxAge: 300000 }),
      );
      expect(mockRes.cookie).not.toHaveBeenCalledWith(
        'token',
        expect.anything(),
        expect.anything(),
      );
      expect(authService.login).not.toHaveBeenCalled();
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
      const url = await resolver.generate2FASecret({
        user: { email: 'a@example.com' },
      } as any);
      expect(authService.generate2FASecret).toHaveBeenCalledWith(
        'a@example.com',
      );
      expect(url).toBe('url');
    });

    it('ignores an email supplied by the caller', async () => {
      (authService.generate2FASecret as jest.Mock).mockResolvedValue({
        qrCodeUrl: 'url',
      });
      await resolver.generate2FASecret(
        { user: { email: 'a@example.com' } } as any,
        'victim@example.com',
      );
      expect(authService.generate2FASecret).toHaveBeenCalledTimes(1);
      expect(authService.generate2FASecret).toHaveBeenCalledWith(
        'a@example.com',
      );
    });
  });

  describe('confirm2FA', () => {
    const req = { user: { email: 'a@example.com' } } as any;

    it('confirms the code for the authenticated user', async () => {
      (authService.confirm2FA as jest.Mock).mockResolvedValue(true);

      await expect(resolver.confirm2FA(req, '123456')).resolves.toBe(true);
      expect(authService.confirm2FA).toHaveBeenCalledWith(
        'a@example.com',
        '123456',
      );
    });

    it('rejects a wrong code', async () => {
      (authService.confirm2FA as jest.Mock).mockResolvedValue(false);

      await expect(resolver.confirm2FA(req, '000000')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verify2FA', () => {
    it('sets auth token after successful 2FA verification', async () => {
      (authService.isValidTwoFactorChallenge as jest.Mock).mockReturnValue(
        true,
      );
      (authService.verify2FAAndLogin as jest.Mock).mockResolvedValue(
        'jwt-token',
      );
      const req = { cookies: { two_factor_challenge: 'challenge-token' } };

      const result = await resolver.verify2FA(
        'a@example.com',
        '123456',
        mockRes as Response,
        req as any,
      );

      expect(authService.isValidTwoFactorChallenge).toHaveBeenCalledWith(
        'challenge-token',
        'a@example.com',
      );
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'two_factor_challenge',
        expect.any(Object),
      );
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        access_token: 'jwt-token',
        is2FAEnabled: true,
      });
    });

    it('rejects a verification that does not follow a password login', async () => {
      (authService.isValidTwoFactorChallenge as jest.Mock).mockReturnValue(
        false,
      );

      await expect(
        resolver.verify2FA(
          'a@example.com',
          '123456',
          mockRes as Response,
          { cookies: {} } as any,
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(authService.verify2FAAndLogin).not.toHaveBeenCalled();
      expect(mockRes.cookie).not.toHaveBeenCalled();
    });

    it('rejects an invalid code', async () => {
      (authService.isValidTwoFactorChallenge as jest.Mock).mockReturnValue(
        true,
      );
      (authService.verify2FAAndLogin as jest.Mock).mockResolvedValue(null);

      await expect(
        resolver.verify2FA(
          'a@example.com',
          '000000',
          mockRes as Response,
          { cookies: { two_factor_challenge: 'challenge-token' } } as any,
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockRes.cookie).not.toHaveBeenCalled();
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
