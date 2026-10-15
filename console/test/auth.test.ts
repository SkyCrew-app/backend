import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT_LOCK_MS,
  checkPassword,
  checkSecondStep,
  csrfMatches,
  elevate,
  getSession,
  isElevated,
  loginRefusal,
  unlockOwner,
} from '../src/security/auth.ts';
import { totpAt } from '../src/security/totp.ts';
import { recordAudit, verifyAuditChain } from '../src/audit.ts';
import { TEST_PASSWORD, TEST_SECRET, dbWithOwner } from './support.ts';

const policy = { idleMinutes: 30, maxHours: 8, elevationMinutes: 5 };
const who = { ip: '203.0.113.7', userAgent: 'test' };

test('password then phone code gives a full session, under a new token', async () => {
  const { db } = await dbWithOwner();
  const t = 1_800_000_000_000;
  const first = await checkPassword(db, { username: 'owner', password: TEST_PASSWORD, ...who }, t);
  assert.equal(first.ok, true);
  const half = getSession(db, (first as { token: string }).token, policy, t)!;
  assert.equal(half.stage, 'password');
  const second = checkSecondStep(db, half, { code: totpAt(TEST_SECRET, t), ...who }, policy, t);
  assert.equal(second.ok, true);
  const token = (second as { token: string }).token;
  assert.notEqual(token, (first as { token: string }).token);
  assert.equal(getSession(db, (first as { token: string }).token, policy, t), null, 'the half session is gone');
  const full = getSession(db, token, policy, t)!;
  assert.equal(full.stage, 'full');
  assert.equal(isElevated(full, t + 60_000), true);
  assert.equal(isElevated(full, t + 6 * 60_000), false);
  // Idle 31 minutes: signed out.
  assert.equal(getSession(db, token, policy, t + 31 * 60_000), null);
});

test('a code works once; a recovery code works once', async () => {
  const { db, codes } = await dbWithOwner();
  const t = 1_800_000_000_000;
  const login = async () => getSession(db, ((await checkPassword(db, { username: 'owner', password: TEST_PASSWORD, ...who }, t)) as { token: string }).token, policy, t)!;
  const code = totpAt(TEST_SECRET, t);
  assert.equal(checkSecondStep(db, await login(), { code, ...who }, policy, t).ok, true);
  assert.equal(checkSecondStep(db, await login(), { code, ...who }, policy, t).ok, false, 'replayed code');
  const recovered = checkSecondStep(db, await login(), { code: codes[3].toUpperCase(), ...who }, policy, t);
  assert.equal(recovered.ok, true);
  assert.equal((recovered as { recoveryUsed?: boolean }).recoveryUsed, true);
  assert.equal(checkSecondStep(db, await login(), { code: codes[3], ...who }, policy, t).ok, false, 'recovery code reused');
});

test('five failures from one address block it for 15 minutes', async () => {
  const { db } = await dbWithOwner();
  const t = 1_800_000_000_000;
  for (let i = 0; i < 5; i++) assert.equal((await checkPassword(db, { username: 'owner', password: 'wrong', ...who }, t + i)).ok, false);
  const blocked = await checkPassword(db, { username: 'owner', password: TEST_PASSWORD, ...who }, t + 10);
  assert.equal(blocked.ok, false);
  assert.equal((blocked as { refusal?: { reason: string } }).refusal?.reason, 'ip');
  // Another address still may.
  assert.equal((await checkPassword(db, { username: 'owner', password: TEST_PASSWORD, ip: '198.51.100.1', userAgent: 't' }, t + 10)).ok, true);
  assert.equal(loginRefusal(db, who.ip, t + 15 * 60_000 + 10), null, 'free again after the window');
});

test('ten failures from many addresses lock the account; unlock lifts it', async () => {
  const { db } = await dbWithOwner();
  const t = 1_800_000_000_000;
  let lockedNow = false;
  for (let i = 0; i < 10; i++) {
    const r = await checkPassword(db, { username: i % 2 ? 'owner' : 'nobody', password: 'wrong', ip: `192.0.2.${i}`, userAgent: 't' }, t + i);
    lockedNow ||= !!(r as { lockedNow?: boolean }).lockedNow;
  }
  assert.equal(lockedNow, true);
  const refused = await checkPassword(db, { username: 'owner', password: TEST_PASSWORD, ip: '192.0.2.99', userAgent: 't' }, t + 100);
  assert.equal((refused as { refusal?: { reason: string } }).refusal?.reason, 'account');
  assert.equal(loginRefusal(db, '192.0.2.99', t + ACCOUNT_LOCK_MS + 100), null);
  unlockOwner(db);
  assert.equal((await checkPassword(db, { username: 'owner', password: TEST_PASSWORD, ip: '192.0.2.99', userAgent: 't' }, t + 200)).ok, true);
});

test('wrong phone codes count as failures too', async () => {
  const { db } = await dbWithOwner();
  const t = 1_800_000_000_000;
  const session = getSession(db, ((await checkPassword(db, { username: 'owner', password: TEST_PASSWORD, ...who }, t)) as { token: string }).token, policy, t)!;
  for (let i = 0; i < 5; i++) assert.equal(checkSecondStep(db, session, { code: '000000', ...who }, policy, t).ok, false);
  const r = checkSecondStep(db, session, { code: totpAt(TEST_SECRET, t), ...who }, policy, t);
  assert.equal((r as { refusal?: { reason: string } }).refusal?.reason, 'ip');
});

test('step-up: a fresh code opens a few minutes; CSRF token compared exactly', async () => {
  const { db } = await dbWithOwner();
  const t = 1_800_000_000_000;
  const half = getSession(db, ((await checkPassword(db, { username: 'owner', password: TEST_PASSWORD, ...who }, t)) as { token: string }).token, policy, t)!;
  const token = (checkSecondStep(db, half, { code: totpAt(TEST_SECRET, t), ...who }, policy, t) as { token: string }).token;
  const later = t + 10 * 60_000;
  const session = getSession(db, token, { ...policy, idleMinutes: 60 }, later)!;
  assert.equal(isElevated(session, later), false);
  assert.equal(elevate(db, session, '123456', who.ip, policy, later).ok, false);
  assert.equal(elevate(db, session, totpAt(TEST_SECRET, later), who.ip, policy, later).ok, true);
  assert.equal(isElevated(session, later + 1000), true);
  assert.equal(csrfMatches(session, session.csrf), true);
  assert.equal(csrfMatches(session, `${session.csrf}x`), false);
  assert.equal(csrfMatches(session, undefined), false);
  assert.equal(csrfMatches(session, ['a']), false);
});

test('the audit log refuses changes and detects tampering', async () => {
  const { db } = await dbWithOwner();
  recordAudit(db, { actor: 'owner', action: 'a' });
  recordAudit(db, { actor: 'owner', action: 'b' });
  assert.throws(() => db.prepare("UPDATE audit SET action = 'x'").run(), /append-only/);
  assert.throws(() => db.prepare('DELETE FROM audit').run(), /append-only/);
  assert.equal(verifyAuditChain(db).ok, true);
  db.exec('DROP TRIGGER audit_no_update');
  db.prepare("UPDATE audit SET action = 'x' WHERE id = 1").run();
  assert.deepEqual(verifyAuditChain(db), { ok: false, brokenAt: 1 });
});
