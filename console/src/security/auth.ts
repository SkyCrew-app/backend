import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Db } from '../db.ts';
import { decoyHash, hashPassword, passwordProblem, verifyPassword } from './password.ts';
import { hashRecoveryCode, newRecoveryCodes, verifyTotp } from './totp.ts';

// One owner account, created on the server by the command line (no sign-up
// page). Signing in takes the password, then a code of the phone app (or a
// recovery code). Sessions live in the database, under the hash of their token.

export const IP_WINDOW_MS = 15 * 60_000;
export const IP_MAX_FAILURES = 5;
export const ACCOUNT_MAX_FAILURES = 10;
export const ACCOUNT_LOCK_MS = 15 * 60_000;
export const PASSWORD_STAGE_MS = 5 * 60_000;

export interface SessionPolicy {
  idleMinutes: number;
  maxHours: number;
  elevationMinutes: number;
}

export interface Session {
  idHash: string;
  csrf: string;
  stage: 'password' | 'full';
  createdAt: number;
  lastSeen: number;
  elevatedUntil: number;
  ip: string;
}

interface OwnerRow {
  username: string;
  password_hash: string;
  totp_secret: string;
  totp_last_step: number | null;
  failed_count: number;
  locked_until: number | null;
}

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const token = (): string => randomBytes(32).toString('base64url');

export const ownerExists = (db: Db): boolean => db.prepare('SELECT 1 FROM owner WHERE id = 1').get() !== undefined;

const owner = (db: Db): OwnerRow | undefined =>
  db.prepare('SELECT username, password_hash, totp_secret, totp_last_step, failed_count, locked_until FROM owner WHERE id = 1').get() as
    | OwnerRow
    | undefined;

export const ownerName = (db: Db): string | null => owner(db)?.username ?? null;

const replaceRecoveryCodes = (db: Db): string[] => {
  const codes = newRecoveryCodes();
  db.exec('DELETE FROM recovery_codes');
  const insert = db.prepare('INSERT INTO recovery_codes (hash) VALUES (?)');
  for (const code of codes) insert.run(hashRecoveryCode(code));
  return codes;
};

/** Creates (or replaces) the owner account. Returns the recovery codes, shown once. */
export const createOwner = async (
  db: Db,
  input: { username: string; password: string; totpSecret: string },
  at = Date.now(),
  cost?: number,
): Promise<string[]> => {
  if (!/^[a-z0-9._-]{3,32}$/.test(input.username)) throw new Error('Identifiant : 3 à 32 caractères a-z, 0-9, point, tiret');
  const problem = passwordProblem(input.password);
  if (problem) throw new Error(`Mot de passe : ${problem}`);
  const hash = await hashPassword(input.password, cost);
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM owner; DELETE FROM sessions;');
    db.prepare(
      'INSERT INTO owner (id, username, password_hash, totp_secret, totp_last_step, failed_count, locked_until, created_at, password_changed_at) VALUES (1, ?, ?, ?, NULL, 0, NULL, ?, ?)',
    ).run(input.username, hash, input.totpSecret, at, at);
    const codes = replaceRecoveryCodes(db);
    db.exec('COMMIT');
    return codes;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

export const setPassword = async (db: Db, password: string, at = Date.now(), cost?: number): Promise<void> => {
  const problem = passwordProblem(password);
  if (problem) throw new Error(`Mot de passe : ${problem}`);
  const hash = await hashPassword(password, cost);
  db.prepare('UPDATE owner SET password_hash = ?, password_changed_at = ?, failed_count = 0, locked_until = NULL WHERE id = 1').run(hash, at);
  db.exec('DELETE FROM sessions');
};

/** New phone app secret and new recovery codes; every session is closed. */
export const resetSecondFactor = (db: Db, totpSecret: string): string[] => {
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE owner SET totp_secret = ?, totp_last_step = NULL WHERE id = 1').run(totpSecret);
    db.exec('DELETE FROM sessions');
    const codes = replaceRecoveryCodes(db);
    db.exec('COMMIT');
    return codes;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

export const unlockOwner = (db: Db): void => {
  db.prepare('UPDATE owner SET failed_count = 0, locked_until = NULL WHERE id = 1').run();
  db.exec('DELETE FROM login_failures');
};

// --- Throttling ---------------------------------------------------------------------

export type Refusal = { reason: 'ip' | 'account'; until: number };

export const loginRefusal = (db: Db, ip: string, at = Date.now()): Refusal | null => {
  db.prepare('DELETE FROM login_failures WHERE at < ?').run(at - IP_WINDOW_MS);
  const rows = db.prepare('SELECT at FROM login_failures WHERE ip = ? ORDER BY at').all(ip) as { at: number }[];
  if (rows.length >= IP_MAX_FAILURES) return { reason: 'ip', until: rows[rows.length - IP_MAX_FAILURES].at + IP_WINDOW_MS };
  const o = owner(db);
  if (o?.locked_until && o.locked_until > at) return { reason: 'account', until: o.locked_until };
  return null;
};

/** Counts a failure; returns true when it just locked the account. */
const recordFailure = (db: Db, ip: string, at: number): boolean => {
  db.prepare('INSERT INTO login_failures (ip, at) VALUES (?, ?)').run(ip, at);
  const o = owner(db);
  if (!o) return false;
  const failed = o.failed_count + 1;
  const lock = failed >= ACCOUNT_MAX_FAILURES;
  db.prepare('UPDATE owner SET failed_count = ?, locked_until = ? WHERE id = 1').run(lock ? 0 : failed, lock ? at + ACCOUNT_LOCK_MS : o.locked_until);
  return lock;
};

// --- Sessions -----------------------------------------------------------------------

const newSession = (db: Db, stage: Session['stage'], ip: string, userAgent: string, at: number, elevatedUntil = 0): string => {
  const t = token();
  db.prepare(
    'INSERT INTO sessions (id_hash, csrf, stage, created_at, last_seen, elevated_until, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(sha256(t), token(), stage, at, at, elevatedUntil, ip, userAgent.slice(0, 200));
  return t;
};

export const getSession = (db: Db, rawToken: string | undefined, policy: SessionPolicy, at = Date.now()): Session | null => {
  if (!rawToken || rawToken.length > 100) return null;
  const idHash = sha256(rawToken);
  const row = db.prepare('SELECT * FROM sessions WHERE id_hash = ?').get(idHash) as
    | { id_hash: string; csrf: string; stage: Session['stage']; created_at: number; last_seen: number; elevated_until: number; ip: string }
    | undefined;
  if (!row) return null;
  const expired =
    row.stage === 'password'
      ? at - row.created_at > PASSWORD_STAGE_MS
      : at - row.last_seen > policy.idleMinutes * 60_000 || at - row.created_at > policy.maxHours * 3_600_000;
  if (expired) {
    db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(idHash);
    return null;
  }
  return {
    idHash,
    csrf: row.csrf,
    stage: row.stage,
    createdAt: row.created_at,
    lastSeen: row.last_seen,
    elevatedUntil: row.elevated_until,
    ip: row.ip,
  };
};

/** Keeps a session alive (each page the owner opens). Background polling does not call it. */
export const touchSession = (db: Db, session: Session, at = Date.now()): void => {
  db.prepare('UPDATE sessions SET last_seen = ? WHERE id_hash = ?').run(at, session.idHash);
};

export const endSession = (db: Db, session: Session): void => {
  db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(session.idHash);
};

export const csrfMatches = (session: Session, sent: unknown): boolean =>
  typeof sent === 'string' &&
  sent.length === session.csrf.length &&
  timingSafeEqual(Buffer.from(sent), Buffer.from(session.csrf));

// --- Signing in ---------------------------------------------------------------------

export type LoginResult =
  | { ok: true; token: string }
  | { ok: false; refusal?: Refusal; lockedNow?: boolean };

/** First step: the password. Gives a short session that only allows the second step. */
export const checkPassword = async (
  db: Db,
  input: { username: string; password: string; ip: string; userAgent: string },
  at = Date.now(),
): Promise<LoginResult> => {
  const refusal = loginRefusal(db, input.ip, at);
  if (refusal) return { ok: false, refusal };
  const o = owner(db);
  const nameOk = o !== undefined && o.username === input.username.trim().toLowerCase();
  const passwordOk = await verifyPassword(input.password, nameOk ? o!.password_hash : await decoyHash());
  if (!nameOk || !passwordOk) return { ok: false, lockedNow: recordFailure(db, input.ip, at) };
  return { ok: true, token: newSession(db, 'password', input.ip, input.userAgent, at) };
};

const useRecoveryCode = (db: Db, code: string, at: number): boolean => {
  const result = db.prepare('UPDATE recovery_codes SET used_at = ? WHERE hash = ? AND used_at IS NULL').run(at, hashRecoveryCode(code));
  return result.changes === 1;
};

/** Checks a phone code (or a recovery code), once. */
const checkSecondFactor = (db: Db, code: string, at: number): boolean => {
  const o = owner(db);
  if (!o) return false;
  const digits = code.replace(/\s/g, '');
  if (/^[0-9]{6}$/.test(digits)) {
    const step = verifyTotp(o.totp_secret, digits, at, o.totp_last_step);
    if (step === null) return false;
    db.prepare('UPDATE owner SET totp_last_step = ? WHERE id = 1').run(step);
    return true;
  }
  return code.length <= 20 && useRecoveryCode(db, code, at);
};

export type SecondStepResult = (LoginResult & { recoveryUsed?: boolean });

/** Second step. On success the short session is replaced by a new full one (new token). */
export const checkSecondStep = (
  db: Db,
  session: Session,
  input: { code: string; ip: string; userAgent: string },
  policy: SessionPolicy,
  at = Date.now(),
): SecondStepResult => {
  const refusal = loginRefusal(db, input.ip, at);
  if (refusal) return { ok: false, refusal };
  if (session.stage !== 'password') return { ok: false };
  const recovery = !/^[0-9\s]{6,8}$/.test(input.code);
  if (!checkSecondFactor(db, input.code, at)) return { ok: false, lockedNow: recordFailure(db, input.ip, at) };
  endSession(db, session);
  db.prepare('UPDATE owner SET failed_count = 0, locked_until = NULL WHERE id = 1').run();
  return {
    ok: true,
    token: newSession(db, 'full', input.ip, input.userAgent, at, at + policy.elevationMinutes * 60_000),
    recoveryUsed: recovery,
  };
};

export const isElevated = (session: Session, at = Date.now()): boolean => session.elevatedUntil > at;

/** Sensitive actions ask for a fresh code: it opens a few minutes during which no other is asked. */
export const elevate = (db: Db, session: Session, code: string, ip: string, policy: SessionPolicy, at = Date.now()): LoginResult => {
  const refusal = loginRefusal(db, ip, at);
  if (refusal) return { ok: false, refusal };
  if (!checkSecondFactor(db, code, at)) return { ok: false, lockedNow: recordFailure(db, ip, at) };
  db.prepare('UPDATE sessions SET elevated_until = ? WHERE id_hash = ?').run(at + policy.elevationMinutes * 60_000, session.idHash);
  session.elevatedUntil = at + policy.elevationMinutes * 60_000;
  return { ok: true, token: '' };
};

export const recoveryCodesLeft = (db: Db): number =>
  (db.prepare('SELECT count(*) AS n FROM recovery_codes WHERE used_at IS NULL').get() as { n: number }).n;
