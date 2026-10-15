import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

// scrypt (memory-hard, built into Node: no native module to compile on the
// server), with the parameters OWASP recommends: N=2^17, r=8, p=1 (128 MiB,
// about a quarter of a second per check). Stored as
// scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>.
const N = 2 ** 17;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

const scrypt = (password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    scryptCallback(password.normalize('NFKC'), salt, KEY_LENGTH, { N: n, r, p, maxmem: 256 * n * r + 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );

export const MIN_PASSWORD_LENGTH = 12;

export const passwordProblem = (password: string): string | null => {
  if (password.length < MIN_PASSWORD_LENGTH) return `Au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  if (password.length > 256) return 'Au plus 256 caractères.';
  return null;
};

export const hashPassword = async (password: string, cost = N): Promise<string> => {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, cost, R, P);
  return ['scrypt', cost, R, P, salt.toString('base64'), hash.toString('base64')].join('$');
};

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  const expected = Buffer.from(parts[5], 'base64');
  if (password.length > 256) return false;
  const actual = await scrypt(password, Buffer.from(parts[4], 'base64'), n, r, p);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

// A fixed hash checked when the account name is wrong, so that a wrong name
// takes as long as a wrong password.
let decoy: string | null = null;
export const decoyHash = async (): Promise<string> => (decoy ??= await hashPassword(randomBytes(16).toString('hex')));
