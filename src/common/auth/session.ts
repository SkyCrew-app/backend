import { JwtService } from '@nestjs/jwt';

export interface SessionTokenPayload {
  sub?: number;
  email?: string;
  role?: string;
  // Session version of the user when the token was issued.
  sv?: number;
  // Set on single-purpose tokens (two-factor challenge…).
  purpose?: string;
}

interface VersionedUser {
  sessionVersion?: number | null;
  // False once an administrator has deactivated the account.
  is_active?: boolean | null;
}

// The one rule every entry point applies to a verified token: it is a
// session token, its user still exists and is not deactivated, and the
// password has not changed since the session was opened.
export const isCurrentSession = (
  payload: SessionTokenPayload | null | undefined,
  user: VersionedUser | null | undefined,
): boolean =>
  !!payload &&
  !payload.purpose &&
  !!user &&
  user.is_active !== false &&
  (payload.sv ?? 0) === (user.sessionVersion ?? 0);

// For the entry points that do not go through the passport strategy (static
// uploads, websocket handshake): the user of a session cookie, or null.
export const userOfSessionToken = async <T extends VersionedUser>(
  token: string | null | undefined,
  findUserByEmail: (email: string) => Promise<T | null | undefined>,
): Promise<T | null> => {
  const secret = process.env.JWT_SECRET;

  if (!token || !secret) {
    return null;
  }

  let payload: SessionTokenPayload;
  try {
    payload = new JwtService({ secret }).verify(token);
  } catch {
    return null;
  }

  if (payload.purpose || !payload.email) {
    return null;
  }

  let user: T | null | undefined;
  try {
    user = await findUserByEmail(payload.email);
  } catch {
    return null;
  }

  return user && isCurrentSession(payload, user) ? user : null;
};
