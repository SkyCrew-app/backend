import { JwtService } from '@nestjs/jwt';
import { isCurrentSession, userOfSessionToken } from '../session';

describe('isCurrentSession', () => {
  const payload = { email: 'p@example.com', sv: 2 };

  it('accepts the session of an active member opened with the current password', () => {
    expect(isCurrentSession(payload, { sessionVersion: 2 })).toBe(true);
    expect(
      isCurrentSession(payload, { sessionVersion: 2, is_active: true }),
    ).toBe(true);
  });

  // Every entry point (API, uploads, websocket) goes through this rule: a
  // deactivated member is signed out everywhere at once.
  it('refuses the session of a deactivated member', () => {
    expect(
      isCurrentSession(payload, { sessionVersion: 2, is_active: false }),
    ).toBe(false);
  });

  it('refuses a session opened before the password changed, a challenge token and an unknown user', () => {
    expect(isCurrentSession(payload, { sessionVersion: 3 })).toBe(false);
    expect(
      isCurrentSession({ ...payload, purpose: '2fa' }, { sessionVersion: 2 }),
    ).toBe(false);
    expect(isCurrentSession(payload, null)).toBe(false);
  });
});

describe('userOfSessionToken', () => {
  const SECRET = 'session-test-secret';
  const token = new JwtService({ secret: SECRET }).sign(
    { email: 'p@example.com', sv: 0 },
    { expiresIn: '5m' },
  );

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it('returns the member of a valid session, and nobody once deactivated', async () => {
    const member = { id: 3, sessionVersion: 0, is_active: true };

    await expect(userOfSessionToken(token, async () => member)).resolves.toBe(
      member,
    );
    await expect(
      userOfSessionToken(token, async () => ({ ...member, is_active: false })),
    ).resolves.toBeNull();
  });
});
