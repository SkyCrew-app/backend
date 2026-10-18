import { registerEnumType } from '@nestjs/graphql';

// What happened when someone tried to sign in (or signed out).
export enum LoginOutcome {
  // The session was opened.
  SUCCESS = 'success',
  // The address belongs to a member, the password did not match.
  WRONG_PASSWORD = 'wrong_password',
  // No member has this address.
  UNKNOWN_ACCOUNT = 'unknown_account',
  // Too many attempts from this address: refused before any check.
  LOCKED_OR_THROTTLED = 'locked_or_throttled',
  // The password was right; the code of the authenticator app is awaited.
  SECOND_FACTOR_REQUIRED = 'second_factor_required',
  // The code of the authenticator app was wrong.
  SECOND_FACTOR_FAILED = 'second_factor_failed',
  // The password was right but an administrator deactivated the account.
  ACCOUNT_DEACTIVATED = 'account_deactivated',
  // The member closed their session.
  LOGOUT = 'logout',
}

// What the attempt was checked with. Skycrew has no recovery codes: an
// account whose authenticator is lost is unlocked by an administrator.
export enum LoginMethod {
  PASSWORD = 'password',
  TWO_FACTOR_CODE = 'two_factor_code',
}

export enum LoginDeviceType {
  DESKTOP = 'desktop',
  MOBILE = 'mobile',
  TABLET = 'tablet',
  BOT = 'bot',
  UNKNOWN = 'unknown',
}

registerEnumType(LoginOutcome, { name: 'LoginOutcome' });
registerEnumType(LoginMethod, { name: 'LoginMethod' });
registerEnumType(LoginDeviceType, { name: 'LoginDeviceType' });

// How long the connection log is kept: 6 months. The CNIL recommends
// keeping the logs of connections to an information system between six
// months and one year (recommandation relative aux mesures de journalisation,
// délibération n° 2021-122 du 14 octobre 2021), and the privacy page of
// Skycrew announces six months.
// The database refuses to delete a line younger than that (see the
// migration AddLoginEvents1799000000001, which states the same interval):
// change both together.
export const LOGIN_EVENTS_RETENTION_MONTHS = 6;

export const LOGIN_EVENTS_PAGE_SIZE = 25;
export const LOGIN_EVENTS_MAX_PAGE_SIZE = 100;
// What a member sees of their own sign-ins.
export const MY_LOGIN_EVENTS_LIMIT = 20;

export const MAX_ATTEMPTED_EMAIL_LENGTH = 120;
export const MAX_USER_AGENT_LENGTH = 300;

// The address typed by someone who has no account, as it is kept: lower
// case, trimmed, cut short. Anything that does not look like an e-mail
// address is not kept at all: people sometimes type their password in the
// address field.
export const attemptedEmailOf = (
  value: string | null | undefined,
): string | null => {
  const email = (value ?? '').trim().toLowerCase();
  if (!email || /\s/.test(email) || !/^[^@]+@[^@]+$/.test(email)) {
    return null;
  }
  return email.slice(0, MAX_ATTEMPTED_EMAIL_LENGTH);
};
