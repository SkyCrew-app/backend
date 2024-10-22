import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { Response, Request } from 'express';

describe('AuthResolver', () => {
  let resolver: AuthResolver;
  let authService: Partial<AuthService>;
  let res: Partial<Response>;
  let req: Partial<Request>;

  beforeEach(async () => {
    authService = {
      validateUser: jest.fn(),
      login: jest.fn().mockResolvedValue('test-token'),
      generate2FASecret: jest
        .fn()
        .mockResolvedValue({ qrCodeUrl: 'qr-code-url' }),
      verify2FACode: jest.fn().mockResolvedValue(true),
    };

    res = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    req = {
      cookies: { email: 'test@example.com' },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    resolver = module.get<AuthResolver>(AuthResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should login and set cookies', async () => {
    const user = { email: 'test@example.com', is2FAEnabled: false } as any;
    (authService.validateUser as jest.Mock).mockResolvedValue(user);
    (authService.login as jest.Mock).mockResolvedValue(
      Promise.resolve('test-token'),
    );

    const result = await resolver.login(
      { email: 'test@example.com', password: 'password' },
      res as Response,
    );

    const resolvedToken = await result.access_token;

    expect(authService.validateUser).toHaveBeenCalledWith(
      'test@example.com',
      'password',
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'email',
      'test@example.com',
      expect.any(Object),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'token',
      'test-token',
      expect.any(Object),
    );

    expect(resolvedToken).toEqual('test-token');
    expect(result.is2FAEnabled).toBe(false);
  });

  it('should get email from cookie', () => {
    const result = resolver.getEmailFromCookie(req as Request);

    expect(result).toBe('test@example.com');
  });

  it('should generate 2FA secret', async () => {
    const result = await resolver.generate2FASecret('test@example.com');

    expect(authService.generate2FASecret).toHaveBeenCalledWith(
      'test@example.com',
    );
    expect(result).toBe('qr-code-url');
  });

  it('should verify 2FA token', async () => {
    const result = await resolver.verify2FA('test@example.com', '123456');

    expect(authService.verify2FACode).toHaveBeenCalledWith(
      'test@example.com',
      '123456',
    );
    expect(result).toBe(true);
  });

  it('should logout and clear cookies', async () => {
    const result = await resolver.logout(res as Response);

    expect(res.clearCookie).toHaveBeenCalledWith('token', expect.any(Object));
    expect(res.clearCookie).toHaveBeenCalledWith('email', expect.any(Object));
    expect(result).toBe(true);
  });
});
