import { ThrottlerException } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { GqlThrottlerGuard } from './gql-throttler.guard';
import { LoginMethod } from '../login-events/login-events';

// A refused sign-in still leaves its line in the connection log.
describe('GqlThrottlerGuard and the connection log', () => {
  const req = { ip: '203.0.113.7', headers: {} };

  const contextOf = (fieldName: string, args: Record<string, unknown>) => {
    const gqlArgs = [{}, args, { req }, { fieldName }];
    return {
      getType: () => 'graphql',
      getArgs: () => gqlArgs,
      getArgByIndex: (index: number) => gqlArgs[index],
      getClass: () => class {},
      getHandler: () => () => undefined,
    } as any;
  };

  const detail = {
    limit: 3,
    ttl: 1000,
    key: 'k',
    tracker: '203.0.113.7',
    totalHits: 4,
    timeToExpire: 1,
    isBlocked: true,
    timeToBlockExpire: 1,
  };

  const guardWith = (recordThrottled: jest.Mock) =>
    new GqlThrottlerGuard([] as any, {} as any, new Reflector(), {
      recordThrottled,
    } as any);

  it('logs a refused password step, then refuses it', async () => {
    const recordThrottled = jest.fn().mockResolvedValue(undefined);
    const guard = guardWith(recordThrottled);

    await expect(
      (guard as any).throwThrottlingException(
        contextOf('login', {
          loginInput: { email: 'anne@club.fr', password: 'hunter2' },
        }),
        detail,
      ),
    ).rejects.toBeInstanceOf(ThrottlerException);

    expect(recordThrottled).toHaveBeenCalledWith({
      method: LoginMethod.PASSWORD,
      email: 'anne@club.fr',
      req,
    });
    expect(JSON.stringify(recordThrottled.mock.calls)).not.toContain('hunter2');
  });

  it('logs a refused code step', async () => {
    const recordThrottled = jest.fn().mockResolvedValue(undefined);
    await expect(
      (guardWith(recordThrottled) as any).throwThrottlingException(
        contextOf('verify2FA', { email: 'anne@club.fr', token: '123456' }),
        detail,
      ),
    ).rejects.toBeInstanceOf(ThrottlerException);

    expect(recordThrottled).toHaveBeenCalledWith({
      method: LoginMethod.TWO_FACTOR_CODE,
      email: 'anne@club.fr',
      req,
    });
  });

  it('logs nothing for the other operations it limits', async () => {
    const recordThrottled = jest.fn();
    await expect(
      (guardWith(recordThrottled) as any).throwThrottlingException(
        contextOf('resetPassword', { token: 't', newPassword: 'p' }),
        detail,
      ),
    ).rejects.toBeInstanceOf(ThrottlerException);
    expect(recordThrottled).not.toHaveBeenCalled();
  });

  it('refuses even when the log fails', async () => {
    const recordThrottled = jest.fn().mockRejectedValue(new Error('down'));
    await expect(
      (guardWith(recordThrottled) as any).throwThrottlingException(
        contextOf('login', { loginInput: { email: 'a@b.fr' } }),
        detail,
      ),
    ).rejects.toBeInstanceOf(ThrottlerException);
  });
});
