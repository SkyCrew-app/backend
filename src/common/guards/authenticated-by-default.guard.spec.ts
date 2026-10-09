import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedByDefaultGuard } from './authenticated-by-default.guard';
import { JwtAuthGuard } from './jwt.guard';

describe('AuthenticatedByDefaultGuard', () => {
  const handler = () => undefined;
  class Target {}
  const context = {
    getHandler: () => handler,
    getClass: () => Target,
  } as unknown as ExecutionContext;

  let reflector: Reflector;
  let guard: AuthenticatedByDefaultGuard;
  let authenticate: jest.SpyInstance;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new AuthenticatedByDefaultGuard(reflector);
    authenticate = jest
      .spyOn(JwtAuthGuard.prototype, 'canActivate')
      .mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires a session for an operation that is not marked public', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    guard.canActivate(context);

    expect(authenticate).toHaveBeenCalledWith(context);
  });

  it('rejects when the session check rejects', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    authenticate.mockReturnValue(false);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('lets a public operation through without checking the session', () => {
    const lookup = jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(true);

    expect(guard.canActivate(context)).toBe(true);
    expect(lookup).toHaveBeenCalledWith(IS_PUBLIC_KEY, [handler, Target]);
    expect(authenticate).not.toHaveBeenCalled();
  });
});
