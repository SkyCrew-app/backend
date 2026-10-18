import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from '../auth.resolver';
import { AuthService, SESSION_LIFETIME_SECONDS } from '../auth.service';
import {
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { GqlThrottlerGuard } from '../../../common/guards/gql-throttler.guard';
import { LoginEventsService } from '../../../common/login-events/login-events.service';
import {
  LoginMethod,
  LoginOutcome,
} from '../../../common/login-events/login-events';

describe('AuthResolver', () => {
  let resolver: AuthResolver;
  let authService: Partial<AuthService>;
  let mockRes: Partial<Response>;
  let mockReq: Partial<Request>;
  let loginEvents: { record: jest.Mock };

  const signIn = (
    outcome: LoginOutcome,
    user: Record<string, unknown> | null = null,
    userId: number | null = (user?.id as number) ?? null,
  ) =>
    (authService.attemptSignIn as jest.Mock).mockResolvedValue({
      user,
      outcome,
      userId,
    });

  beforeEach(async () => {
    authService = {
      validateUser: jest.fn(),
      validateSignIn: jest.fn(),
      attemptSignIn: jest.fn(),
      attemptSecondFactor: jest.fn(),
      sessionUserIdOf: jest.fn().mockReturnValue(null),
      deactivatedAccountError: jest
        .fn()
        .mockReturnValue(new ForbiddenException('deactivated')),
      login: jest.fn(),
      generate2FASecret: jest.fn(),
      verify2FACode: jest.fn(),
      verify2FAAndLogin: jest.fn(),
      confirm2FA: jest.fn(),
      isTwoFactorEnabled: jest.fn(),
      disable2FA: jest.fn(),
      createTwoFactorChallenge: jest.fn().mockReturnValue('challenge-token'),
      isValidTwoFactorChallenge: jest.fn(),
    };
    mockRes = { cookie: jest.fn(), clearCookie: jest.fn() };
    mockReq = { cookies: {} };
    loginEvents = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        { provide: AuthService, useValue: authService },
        { provide: LoginEventsService, useValue: loginEvents },
      ],
    })
      .overrideGuard(GqlThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = module.get<AuthResolver>(AuthResolver);
  });

  describe('login', () => {
    it('throws UnauthorizedException with invalid credentials', async () => {
      signIn(LoginOutcome.WRONG_PASSWORD, null, 3);
      await expect(
        resolver.login(
          { email: 'a@example.com', password: 'wrong' },
          mockRes as Response,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    // The frontend no longer writes this cookie: the API alone gives it the
    // life of the token it carries.
    it('sets the session cookie for exactly the life of the token', async () => {
      const user = { id: 3, email: 'a@example.com' } as any;
      signIn(LoginOutcome.SUCCESS, user);
      (authService.login as jest.Mock).mockResolvedValue('jwt-token');

      await resolver.login(
        { email: 'a@example.com', password: 'pass' },
        mockRes as Response,
      );

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'token',
        'jwt-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
          maxAge: SESSION_LIFETIME_SECONDS * 1000,
        }),
      );
    });

    it('does not set auth token when 2FA is required', async () => {
      const user = {
        id: 3,
        email: 'a@example.com',
        twoFactorAuthSecret: 'sec',
      } as any;
      signIn(LoginOutcome.SECOND_FACTOR_REQUIRED, user);

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
        { password: undefined, code: undefined },
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
        { password: undefined, code: undefined },
      );
    });

    it('passes the proof asked to replace an active secret', async () => {
      (authService.generate2FASecret as jest.Mock).mockResolvedValue({
        qrCodeUrl: 'url',
      });
      await resolver.generate2FASecret(
        { user: { email: 'a@example.com' } } as any,
        undefined,
        'current-password',
        '123456',
      );
      expect(authService.generate2FASecret).toHaveBeenCalledWith(
        'a@example.com',
        { password: 'current-password', code: '123456' },
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

  describe('twoFactorEnabled', () => {
    it('answers for the authenticated user only', async () => {
      const req = { user: { email: 'me@example.com' } } as any;
      (authService.isTwoFactorEnabled as jest.Mock).mockResolvedValue(true);

      await expect(resolver.twoFactorEnabled(req)).resolves.toBe(true);
      expect(authService.isTwoFactorEnabled).toHaveBeenCalledWith(
        'me@example.com',
      );
    });
  });

  describe('disable2FA', () => {
    const req = { user: { email: 'me@example.com' } } as any;

    it('disables two-factor for the authenticated user', async () => {
      (authService.disable2FA as jest.Mock).mockResolvedValue(true);

      await expect(resolver.disable2FA(req, 'secret')).resolves.toBe(true);
      expect(authService.disable2FA).toHaveBeenCalledWith(
        'me@example.com',
        'secret',
      );
    });

    it('refuses a wrong password', async () => {
      (authService.disable2FA as jest.Mock).mockResolvedValue(false);

      await expect(resolver.disable2FA(req, 'wrong')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verify2FA', () => {
    it('sets auth token after successful 2FA verification', async () => {
      (authService.isValidTwoFactorChallenge as jest.Mock).mockReturnValue(
        true,
      );
      (authService.attemptSecondFactor as jest.Mock).mockResolvedValue({
        jwt: 'jwt-token',
        outcome: LoginOutcome.SUCCESS,
        userId: 3,
      });
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

      expect(authService.attemptSecondFactor).not.toHaveBeenCalled();
      // Without the password step, nothing was tried on an account.
      expect(loginEvents.record).not.toHaveBeenCalled();
      expect(mockRes.cookie).not.toHaveBeenCalled();
    });

    it('rejects an invalid code', async () => {
      (authService.isValidTwoFactorChallenge as jest.Mock).mockReturnValue(
        true,
      );
      (authService.attemptSecondFactor as jest.Mock).mockResolvedValue({
        jwt: null,
        outcome: LoginOutcome.SECOND_FACTOR_FAILED,
        userId: 3,
      });

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

  // Who signs in to which account, and how it went: every step of a
  // sign-in leaves one line, and none of them holds the secret typed.
  describe('connection log', () => {
    const visitor = {
      ip: '203.0.113.7',
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Firefox/131.0' },
      cookies: {},
    } as any;
    const credentials = { email: 'Anne@Club.fr', password: 'hunter2-secret' };

    const lastLine = () =>
      loginEvents.record.mock.calls[
        loginEvents.record.mock.calls.length - 1
      ][0];

    const expectNoSecret = () => {
      const written = JSON.stringify(
        loginEvents.record.mock.calls.map(([attempt]) => ({
          ...attempt,
          req: undefined,
        })),
      );
      for (const secret of [
        'hunter2-secret',
        '654321',
        'jwt-token',
        'challenge-token',
        'session-cookie',
      ]) {
        expect(written).not.toContain(secret);
      }
    };

    it('logs a successful sign-in with the password', async () => {
      signIn(LoginOutcome.SUCCESS, { id: 3, email: 'anne@club.fr' });
      (authService.login as jest.Mock).mockResolvedValue('jwt-token');

      await resolver.login(credentials, mockRes as Response, visitor);

      expect(loginEvents.record).toHaveBeenCalledTimes(1);
      expect(lastLine()).toEqual({
        outcome: LoginOutcome.SUCCESS,
        method: LoginMethod.PASSWORD,
        userId: 3,
        email: 'Anne@Club.fr',
        req: visitor,
      });
      expectNoSecret();
    });

    it('logs a wrong password against the account tried', async () => {
      signIn(LoginOutcome.WRONG_PASSWORD, null, 3);

      await expect(
        resolver.login(credentials, mockRes as Response, visitor),
      ).rejects.toThrow(UnauthorizedException);

      expect(lastLine()).toMatchObject({
        outcome: LoginOutcome.WRONG_PASSWORD,
        userId: 3,
      });
      expectNoSecret();
    });

    it('logs an address that matches no account, with the address', async () => {
      signIn(LoginOutcome.UNKNOWN_ACCOUNT, null, null);

      await expect(
        resolver.login(credentials, mockRes as Response, visitor),
      ).rejects.toThrow(UnauthorizedException);

      expect(lastLine()).toMatchObject({
        outcome: LoginOutcome.UNKNOWN_ACCOUNT,
        userId: null,
        email: 'Anne@Club.fr',
      });
      expectNoSecret();
    });

    it('logs a deactivated account and still refuses it', async () => {
      signIn(LoginOutcome.ACCOUNT_DEACTIVATED, { id: 3, is_active: false });

      await expect(
        resolver.login(credentials, mockRes as Response, visitor),
      ).rejects.toThrow(ForbiddenException);

      expect(lastLine()).toMatchObject({
        outcome: LoginOutcome.ACCOUNT_DEACTIVATED,
        userId: 3,
      });
      expect(mockRes.cookie).not.toHaveBeenCalled();
    });

    it('logs that the code of the authenticator is awaited', async () => {
      signIn(LoginOutcome.SECOND_FACTOR_REQUIRED, {
        id: 3,
        email: 'anne@club.fr',
        twoFactorAuthSecret: 'BASE32SECRET',
      });

      await resolver.login(credentials, mockRes as Response, visitor);

      expect(lastLine()).toMatchObject({
        outcome: LoginOutcome.SECOND_FACTOR_REQUIRED,
        method: LoginMethod.PASSWORD,
        userId: 3,
      });
      expect(JSON.stringify({ ...lastLine(), req: undefined })).not.toContain(
        'BASE32SECRET',
      );
    });

    it('logs the second step, failed then successful', async () => {
      (authService.isValidTwoFactorChallenge as jest.Mock).mockReturnValue(
        true,
      );
      const req = {
        ...visitor,
        cookies: { two_factor_challenge: 'challenge-token' },
      };
      (authService.attemptSecondFactor as jest.Mock).mockResolvedValueOnce({
        jwt: null,
        outcome: LoginOutcome.SECOND_FACTOR_FAILED,
        userId: 3,
      });
      await expect(
        resolver.verify2FA('anne@club.fr', '654321', mockRes as Response, req),
      ).rejects.toThrow(UnauthorizedException);
      expect(lastLine()).toMatchObject({
        outcome: LoginOutcome.SECOND_FACTOR_FAILED,
        method: LoginMethod.TWO_FACTOR_CODE,
        userId: 3,
      });

      (authService.attemptSecondFactor as jest.Mock).mockResolvedValueOnce({
        jwt: 'jwt-token',
        outcome: LoginOutcome.SUCCESS,
        userId: 3,
      });
      await resolver.verify2FA(
        'anne@club.fr',
        '654321',
        mockRes as Response,
        req,
      );
      expect(lastLine()).toMatchObject({
        outcome: LoginOutcome.SUCCESS,
        method: LoginMethod.TWO_FACTOR_CODE,
        userId: 3,
      });
      expectNoSecret();
    });

    it('logs a sign-out of a genuine session only', async () => {
      (authService.sessionUserIdOf as jest.Mock).mockImplementation(
        (token: string) => (token === 'session-cookie' ? 3 : null),
      );

      await resolver.logout(mockRes as Response, {
        ...visitor,
        cookies: { token: 'session-cookie' },
      });
      expect(lastLine()).toMatchObject({
        outcome: LoginOutcome.LOGOUT,
        method: null,
        userId: 3,
      });

      loginEvents.record.mockClear();
      await resolver.logout(mockRes as Response, {
        ...visitor,
        cookies: { token: 'forged' },
      });
      await resolver.logout(mockRes as Response, visitor);
      expect(loginEvents.record).not.toHaveBeenCalled();
      expectNoSecret();
    });

    it('never holds a sign-in back when the log cannot be written', async () => {
      loginEvents.record.mockRejectedValue(new Error('database down'));
      signIn(LoginOutcome.SUCCESS, { id: 3, email: 'anne@club.fr' });
      (authService.login as jest.Mock).mockResolvedValue('jwt-token');

      await expect(
        resolver.login(credentials, mockRes as Response, visitor),
      ).resolves.toEqual({ access_token: 'jwt-token', is2FAEnabled: false });
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'token',
        'jwt-token',
        expect.any(Object),
      );
    });
  });
});
