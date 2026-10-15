import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Time-based one-time passwords (RFC 6238, the codes of Google Authenticator,
// Microsoft Authenticator, 1Password...): SHA-1, 6 digits, 30 seconds.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_SECONDS = 30;

export const base32Encode = (bytes: Buffer): string => {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
};

export const base32Decode = (text: string): Buffer => {
  const clean = text.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('invalid base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
};

export const newTotpSecret = (): string => base32Encode(randomBytes(20));

export const stepAt = (unixMs: number): number => Math.floor(unixMs / 1000 / STEP_SECONDS);

// HOTP (RFC 4226) for one counter value.
export const hotp = (secret: Buffer, counter: number, digits = 6, algorithm = 'sha1'): string => {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac(algorithm, secret).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return code.toString().padStart(digits, '0');
};

export const totpAt = (secretBase32: string, unixMs: number): string => hotp(base32Decode(secretBase32), stepAt(unixMs));

/**
 * The step a code belongs to (the current one, or one either side for a phone
 * slightly early or late), or null. A step at or before `lastUsedStep` is
 * refused: a code works once.
 */
export const verifyTotp = (
  secretBase32: string,
  code: string,
  unixMs: number,
  lastUsedStep: number | null,
): number | null => {
  if (!/^[0-9]{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const now = stepAt(unixMs);
  for (const step of [now, now - 1, now + 1]) {
    const expected = Buffer.from(hotp(secret, step));
    if (timingSafeEqual(expected, Buffer.from(code)) && (lastUsedStep === null || step > lastUsedStep)) return step;
  }
  return null;
};

export const otpauthUri = (secretBase32: string, account: string, issuer = 'SkyCrew Console'): string =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

// Recovery codes: 10 random codes of 10 characters (50 bits each), stored as
// SHA-256 hashes, each usable once instead of a phone code.
export const newRecoveryCodes = (count = 10): string[] =>
  Array.from({ length: count }, () => {
    const raw = base32Encode(randomBytes(7)).slice(0, 10).toLowerCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });

export const normalizeRecoveryCode = (code: string): string => code.toLowerCase().replace(/[^a-z2-7]/g, '');

export const hashRecoveryCode = (code: string): string =>
  createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
