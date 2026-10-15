import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base32Decode, base32Encode, hashRecoveryCode, hotp, newRecoveryCodes, newTotpSecret, totpAt, verifyTotp } from '../src/security/totp.ts';
import { hashPassword, verifyPassword } from '../src/security/password.ts';

// RFC 6238, appendix B (SHA-1, 8 digits).
const RFC_SECRET = Buffer.from('12345678901234567890');
test('TOTP matches the RFC 6238 test vectors', () => {
  for (const [time, code] of [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ] as const) {
    assert.equal(hotp(RFC_SECRET, Math.floor(time / 30), 8), code);
  }
});

test('base32 round trip and secrets', () => {
  const bytes = Buffer.from('hello world, totp!');
  assert.deepEqual(base32Decode(base32Encode(bytes)), bytes);
  assert.equal(base32Encode(RFC_SECRET), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.match(newTotpSecret(), /^[A-Z2-7]{32}$/);
});

test('a code is accepted for its step and the steps either side, and once only', () => {
  const secret = newTotpSecret();
  const t = 1_800_000_000_000;
  const code = totpAt(secret, t);
  const step = verifyTotp(secret, code, t, null);
  assert.equal(step, Math.floor(t / 30000));
  assert.equal(verifyTotp(secret, code, t + 30_000, null), step, 'one step late');
  assert.equal(verifyTotp(secret, code, t + 90_000, null), null, 'three steps late');
  assert.equal(verifyTotp(secret, code, t, step), null, 'reused');
  assert.equal(verifyTotp(secret, '12345', t, null), null);
  assert.equal(verifyTotp(secret, 'abcdef', t, null), null);
});

test('recovery codes: ten distinct codes, hashed whatever the spelling', () => {
  const codes = newRecoveryCodes();
  assert.equal(new Set(codes).size, 10);
  for (const c of codes) assert.match(c, /^[a-z2-7]{5}-[a-z2-7]{5}$/);
  assert.equal(hashRecoveryCode(codes[0]), hashRecoveryCode(codes[0].toUpperCase().replace('-', ' ')));
});

test('passwords: scrypt, salted, checked in constant time', async () => {
  const a = await hashPassword('une phrase de passe assez longue', 2 ** 10);
  const b = await hashPassword('une phrase de passe assez longue', 2 ** 10);
  assert.notEqual(a, b);
  assert.match(a, /^scrypt\$1024\$8\$1\$/);
  assert.equal(await verifyPassword('une phrase de passe assez longue', a), true);
  assert.equal(await verifyPassword('une phrase de passe assez longuE', a), false);
  assert.equal(await verifyPassword('x', 'md5$abc'), false);
  const strong = await hashPassword('production cost check', 2 ** 17);
  assert.match(strong, /^scrypt\$131072\$/);
});
