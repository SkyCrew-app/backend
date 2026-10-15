import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateClub, evaluateServer, parseStatus } from '../src/servers/status.ts';
import { healthyClub, statusLines } from './support.ts';

test('a healthy club is OK; each problem is named and graded like clubs.sh', () => {
  const ok = evaluateClub('s', 'a', { ...healthyClub(), domain_ready: '200' });
  assert.equal(ok.level, 0, ok.reasons.join(';'));
  assert.equal(ok.containers, '5/5');
  const down = evaluateClub('s', 'a', { ...healthyClub({ svc_backend: 'exited -', local_ready: '502' }), domain_ready: '000' });
  assert.equal(down.level, 2);
  assert.ok(down.reasons.some((r) => r.includes('backend arrêté')));
  const suspended = evaluateClub('s', 'a', { ...healthyClub({ suspended: '1' }), domain_ready: '200' });
  assert.equal(suspended.level, 1);
  assert.ok(suspended.reasons.some((r) => r.includes('suspendu')));
  const full = evaluateClub('s', 'a', { ...healthyClub({ aircraft: '5' }), domain_ready: '200' });
  assert.ok(full.reasons.some((r) => r.includes('plafond d’avions atteint (5/5)')));
});

test('room left on a server: memory and disk estimates', () => {
  const { server, clubs } = parseStatus(statusLines({ a: healthyClub(), b: healthyClub({ mem_mb: '900' }) }));
  assert.equal(clubs.size, 2);
  const evaluated = [...clubs.entries()].map(([slug, f]) => evaluateClub('s', slug, { ...f, domain_ready: '200' }));
  const s = evaluateServer('s', server, evaluated, Date.now());
  // (12000 - 1600) / 800 = 13 by memory; (150000 - 20000) / 2048 = 63 by disk.
  assert.equal(s.fitMemory, 13);
  assert.equal(s.fitDisk, 63);
  assert.equal(s.fit, 13);
  assert.equal(s.level, 0);
  const unreachable = evaluateServer('x', {}, [], Date.now(), 'ssh: connect timed out');
  assert.equal(unreachable.reachable, false);
  assert.equal(unreachable.level, 2);
});
