import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../jwt.strategy';

describe('JwtStrategy', () => {
  const users = { findSessionUser: jest.fn() };
  const config = { get: () => 'test-secret' };
  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(users as any, config as any);
  });

  const member = (sessionVersion?: number) => ({
    id: 3,
    email: 'p@example.com',
    sessionVersion,
  });

  it('accepts a session opened with the current password', async () => {
    users.findSessionUser.mockResolvedValue(member(2));

    await expect(
      strategy.validate({ email: 'p@example.com', sv: 2 }),
    ).resolves.toMatchObject({ id: 3 });
  });

  it('refuses a session opened before the password changed', async () => {
    users.findSessionUser.mockResolvedValue(member(3));

    await expect(
      strategy.validate({ email: 'p@example.com', sv: 2 }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a session opened before sessions were versioned, until the password changes', async () => {
    users.findSessionUser.mockResolvedValue(member(0));
    await expect(
      strategy.validate({ email: 'p@example.com' }),
    ).resolves.toMatchObject({ id: 3 });

    users.findSessionUser.mockResolvedValue(member(1));
    await expect(strategy.validate({ email: 'p@example.com' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refuses a single-purpose token and an unknown user', async () => {
    await expect(
      strategy.validate({ email: 'p@example.com', purpose: '2fa' }),
    ).rejects.toThrow(UnauthorizedException);

    users.findSessionUser.mockResolvedValue(null);
    await expect(
      strategy.validate({ email: 'ghost@example.com', sv: 0 }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
