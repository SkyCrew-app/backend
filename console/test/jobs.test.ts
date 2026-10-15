import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Fleet } from '../src/fleet.ts';
import { Jobs, redactLine } from '../src/jobs.ts';
import { dbWithOwner, fakeRunner, healthyClub, statusLines, testConfig } from './support.ts';

const setup = async (answer: Parameters<typeof fakeRunner>[0]) => {
  const { db } = await dbWithOwner();
  const config = testConfig({ CONSOLE_SERVERS: 'alpha=local' });
  const runner = fakeRunner((call, server) => {
    if (call.action === 'status') return { output: statusLines({ a: healthyClub(), b: healthyClub(), c: healthyClub() }) };
    return answer(call, server);
  });
  const fleet = new Fleet(config, runner, async () => '200');
  return { db, runner, jobs: new Jobs(db, config, fleet, runner) };
};

test('nothing secret or personal is kept in a job output', () => {
  assert.equal(redactLine('admin: president@aeroclub.fr'), 'admin: [e-mail masqué]');
  assert.equal(redactLine('ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/123/abc'), 'ALERT_WEBHOOK_URL=[webhook masqué]');
  assert.equal(redactLine('JWT_SECRET=0123abcd'), 'JWT_SECRET=[masqué]');
  assert.equal(redactLine('MAIL_PASSWORD=hunter2 ok'), 'MAIL_PASSWORD=[masqué] ok');
  assert.equal(redactLine('token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjF9.sig_abc'), 'token [jeton masqué]');
  assert.equal(redactLine('key sk_live_abcDEF123'), 'key [clé masquée]');
  assert.equal(redactLine(`db ${'a1'.repeat(32)}`), 'db [empreinte masquée]');
  assert.equal(redactLine('backend 2.19.0 healthy'), 'backend 2.19.0 healthy');
});

test('the provisional password of a new club is shown once, never stored', async () => {
  const { jobs, db } = await setup(() => ({ lines: ['== Terminé', 'Mot de passe provisoire : Abc123xyz', 'suite'] }));
  const id = jobs.enqueue({ kind: 'create', server: 'alpha', slug: 'vexin', params: { domain: 'v.fr', adminEmail: 'a@v.fr', plan: 'club', maxAircraft: null, maxMembers: null, backend: '2.19.0', frontend: '2.15.0' }, actor: 'owner' });
  await jobs.drain();
  assert.equal(jobs.get(id)!.status, 'succeeded');
  const stored = (db.prepare('SELECT group_concat(line, char(10)) AS t FROM job_logs').get() as { t: string }).t;
  assert.equal(stored.includes('Abc123xyz'), false);
  assert.equal(jobs.hasPassword(id), true);
  assert.equal(jobs.takePassword(id), 'Abc123xyz');
  assert.equal(jobs.takePassword(id), null);
});

test('an update whose new versions fail is reported as rolled back', async () => {
  const { jobs } = await setup(() => ({ code: 1, lines: ['new versions did not come up healthy', 'UPDATE_RESULT=rolled_back'] }));
  const id = jobs.enqueue({ kind: 'update', server: 'alpha', slug: 'a', params: { backend: '9.9.9', frontend: null }, actor: 'owner' });
  await jobs.drain();
  const job = jobs.get(id)!;
  assert.equal(job.status, 'rolled_back');
  assert.match(job.summary!, /revenu tout seul/);
});

test('update of several clubs: one after the other, stops at the first failure', async () => {
  const { jobs, runner } = await setup((call) => (call.action === 'update' && 'slug' in call && call.slug === 'b' ? { code: 1, lines: ['UPDATE_RESULT=rolled_back'] } : { lines: ['UPDATE_RESULT=updated'] }));
  const id = jobs.enqueue({ kind: 'update-all', server: 'alpha', slug: null, params: { backend: '2.19.0', frontend: null, targets: [{ server: 'alpha', slug: 'a' }, { server: 'alpha', slug: 'b' }, { server: 'alpha', slug: 'c' }], continueOnError: false }, actor: 'owner' });
  await jobs.drain();
  const job = jobs.get(id)!;
  assert.equal(job.status, 'failed');
  assert.match(job.summary!, /mis à jour : a \(alpha\) ; en échec : b \(alpha\) ; pas tentés : c \(alpha\)/);
  assert.deepEqual(runner.calls.filter((c) => c.call.action === 'update').map((c) => (c.call as { slug: string }).slug), ['a', 'b']);
  assert.deepEqual(jobs.children(id).map((j) => `${j.slug}:${j.status}`), ['a:succeeded', 'b:rolled_back']);
});

test('clubs already in the asked versions are skipped', async () => {
  const { jobs, runner } = await setup(() => ({ lines: ['UPDATE_RESULT=updated'] }));
  const id = jobs.enqueue({ kind: 'update-all', server: 'alpha', slug: null, params: { backend: '2.18.0', frontend: '2.14.0', targets: [{ server: 'alpha', slug: 'a' }], continueOnError: false }, actor: 'owner' });
  await jobs.drain();
  assert.equal(jobs.get(id)!.status, 'succeeded');
  assert.equal(runner.calls.filter((c) => c.call.action === 'update').length, 0);
});

test('one job at a time per club; a waiting job can be cancelled, a running one cannot', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const { db } = await dbWithOwner();
  const config = testConfig({ CONSOLE_SERVERS: 'alpha=local' });
  let concurrent = 0;
  let max = 0;
  const runner = fakeRunner(() => ({}));
  const slow = (async (...args: Parameters<typeof runner>) => {
    concurrent++;
    max = Math.max(max, concurrent);
    await gate;
    concurrent--;
    return runner(...args);
  }) as typeof runner;
  const jobs = new Jobs(db, config, new Fleet(config, runner, async () => '200'), slow);
  const first = jobs.enqueue({ kind: 'backup', server: 'alpha', slug: 'a', params: {}, actor: 'owner' });
  const second = jobs.enqueue({ kind: 'backup', server: 'alpha', slug: 'a', params: {}, actor: 'owner' });
  const third = jobs.enqueue({ kind: 'backup', server: 'alpha', slug: 'a', params: {}, actor: 'owner' });
  const other = jobs.enqueue({ kind: 'backup', server: 'alpha', slug: 'b', params: {}, actor: 'owner' });
  jobs.tick();
  assert.equal(jobs.get(first)!.status, 'running');
  assert.equal(jobs.get(second)!.status, 'queued');
  assert.equal(jobs.get(other)!.status, 'running', 'another club is free');
  assert.equal(jobs.cancel(first), 'not-cancellable');
  assert.equal(jobs.cancel(third), 'cancelled');
  release();
  await jobs.drain();
  assert.equal(jobs.get(second)!.status, 'succeeded');
  assert.equal(jobs.get(third)!.status, 'cancelled');
  assert.equal(max, 2);
});

test('a job cut by a restart of the console is marked interrupted', async () => {
  const { db } = await dbWithOwner();
  const config = testConfig({ CONSOLE_SERVERS: 'alpha=local' });
  const fleet = new Fleet(config, fakeRunner(() => ({})), async () => '200');
  db.prepare("INSERT INTO jobs (kind, server, slug, params, status, actor, created_at) VALUES ('update', 'alpha', 'a', '{}', 'running', 'owner', 1)").run();
  const jobs = new Jobs(db, config, fleet);
  assert.equal(jobs.get(1)!.status, 'interrupted');
});
