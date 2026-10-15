import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { Fleet } from '../src/fleet.ts';
import { Jobs } from '../src/jobs.ts';
import { totpAt } from '../src/security/totp.ts';
import { buildApp } from '../src/web/server.ts';
import { TEST_PASSWORD, TEST_SECRET, dbWithOwner, fakeRunner, healthyClub, statusLines, testConfig } from './support.ts';

const ORIGIN = 'https://console.test';

const setup = async () => {
  const { db } = await dbWithOwner();
  const config = testConfig({ CONSOLE_SERVERS: 'alpha=local' });
  const runner = fakeRunner((call) => {
    if (call.action === 'status') return { output: statusLines({ vexin: healthyClub({ url: '' }) }) };
    if (call.action === 'images') return { output: 'backend\t2.18.0\nfrontend\t2.14.0\nbackend\t2.19.0\n' };
    return { lines: ['ok'], code: 0 };
  });
  const fleet = new Fleet(config, runner, async () => '200');
  const jobs = new Jobs(db, config, fleet, runner);
  const app = await buildApp({ config, db, fleet, jobs });
  return { db, app, runner, jobs };
};

class Browser {
  cookies = new Map<string, string>();
  app: FastifyInstance;
  constructor(app: FastifyInstance) {
    this.app = app;
  }
  private keep(headers: Record<string, unknown>) {
    const set = headers['set-cookie'];
    for (const c of Array.isArray(set) ? set : set ? [String(set)] : []) {
      const [pair] = c.split(';');
      const [name, value] = pair.split('=');
      if (/Max-Age=0/.test(c)) this.cookies.delete(name);
      else this.cookies.set(name, decodeURIComponent(value));
    }
  }
  private cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
  }
  async get(url: string) {
    const r = await this.app.inject({ method: 'GET', url, headers: { cookie: this.cookieHeader() } });
    this.keep(r.headers);
    return r;
  }
  async post(url: string, form: Record<string, string>, headers: Record<string, string> = { origin: ORIGIN }) {
    const r = await this.app.inject({
      method: 'POST',
      url,
      headers: { cookie: this.cookieHeader(), 'content-type': 'application/x-www-form-urlencoded', ...headers },
      payload: new URLSearchParams(form).toString(),
    });
    this.keep(r.headers);
    return r;
  }
}

const field = (body: string, name: string) => new RegExp(`name="${name}" value="([^"]*)"`).exec(body)?.[1] ?? '';

const signIn = async (app: FastifyInstance) => {
  const b = new Browser(app);
  const login = await b.get('/login');
  const r1 = await b.post('/login', { _csrf: field(login.body, '_csrf'), username: 'owner', password: TEST_PASSWORD });
  assert.equal(r1.statusCode, 303);
  assert.equal(r1.headers.location, '/login/code');
  const codePage = await b.get('/login/code');
  const r2 = await b.post('/login/code', { _csrf: field(codePage.body, '_csrf'), code: totpAt(TEST_SECRET, Date.now()) });
  assert.equal(r2.statusCode, 303);
  assert.equal(r2.headers.location, '/');
  return b;
};

test('pages need a full sign-in; headers are strict', async () => {
  const { app } = await setup();
  const anonymous = await app.inject({ method: 'GET', url: '/' });
  assert.equal(anonymous.statusCode, 303);
  assert.match(String(anonymous.headers.location), /^\/login/);
  const login = await app.inject({ method: 'GET', url: '/login' });
  assert.match(String(login.headers['content-security-policy']), /default-src 'none'.*script-src 'self'/);
  assert.equal(login.headers['x-frame-options'], 'DENY');
  assert.equal(login.headers['cache-control'], 'no-store');
  assert.equal(login.headers['referrer-policy'], 'same-origin');
  assert.match(String(login.headers['strict-transport-security']), /max-age=/);
  const cookie = String(login.headers['set-cookie']);
  assert.match(cookie, /^__Host-skycrew_console_pre=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  assert.equal((await app.inject({ method: 'GET', url: '/jobs/1/log.json' })).statusCode, 401);
});

test('sign in with password and phone code, see the clubs, sign out', async () => {
  const { app } = await setup();
  const b = await signIn(app);
  const home = await b.get('/');
  assert.equal(home.statusCode, 200);
  assert.match(home.body, /vexin/);
  assert.match(home.body, /Se déconnecter \(owner\)/);
  const out = await b.post('/logout', { _csrf: field(home.body, '_csrf') });
  assert.equal(out.statusCode, 303);
  assert.equal((await b.get('/')).statusCode, 303);
});

test('a half session (password only) opens nothing', async () => {
  const { app } = await setup();
  const b = new Browser(app);
  const login = await b.get('/login');
  await b.post('/login', { _csrf: field(login.body, '_csrf'), username: 'owner', password: TEST_PASSWORD });
  assert.equal((await b.get('/')).statusCode, 303);
  assert.equal((await b.get('/stripe')).statusCode, 303);
});

test('login is refused without the page token or from another origin', async () => {
  const { app } = await setup();
  const b = new Browser(app);
  const login = await b.get('/login');
  assert.equal((await b.post('/login', { _csrf: 'forged', username: 'owner', password: TEST_PASSWORD })).statusCode, 403);
  const again = await b.get('/login');
  assert.equal((await b.post('/login', { _csrf: field(again.body, '_csrf'), username: 'owner', password: TEST_PASSWORD }, { origin: 'https://evil.example' })).statusCode, 403);
  void login;
});

test('every state-changing request needs the CSRF token and the console origin', async () => {
  const { app, runner } = await setup();
  const b = await signIn(app);
  const home = await b.get('/');
  const csrf = field(home.body, '_csrf');
  const form = { server: 'alpha', slug: 'vexin', step: 'run', code: totpAt(TEST_SECRET, Date.now()) };
  assert.equal((await b.post('/act/backup', { ...form })).statusCode, 403, 'no token');
  assert.equal((await b.post('/act/backup', { ...form, _csrf: 'x'.repeat(csrf.length) })).statusCode, 403, 'wrong token');
  assert.equal((await b.post('/act/backup', { ...form, _csrf: csrf }, { origin: 'https://evil.example' })).statusCode, 403, 'other origin');
  assert.equal((await b.post('/act/backup', { ...form, _csrf: csrf }, {})).statusCode, 403, 'no origin nor referer');
  assert.equal((await b.post('/act/backup', { ...form, _csrf: csrf }, { origin: 'null' })).statusCode, 403, 'opaque origin');
  assert.equal(runner.calls.filter((c) => c.call.action === 'backup').length, 0);
  const ok = await b.post('/act/backup', { ...form, _csrf: csrf });
  assert.equal(ok.statusCode, 303);
  assert.match(String(ok.headers.location), /^\/jobs\/\d+/);
});

test('an action is reviewed, then confirmed with a code, then runs in the background', async () => {
  const { app, runner, jobs, db } = await setup();
  const b = await signIn(app);
  const csrf = field((await b.get('/')).body, '_csrf');
  const review = await b.post('/act/set-plan', { _csrf: csrf, server: 'alpha', slug: 'vexin', step: 'review', plan: 'ecole', maxAircraft: '2', maxMembers: '' });
  assert.equal(review.statusCode, 200);
  assert.match(review.body, /Formule : club → Club \+ École/);
  assert.match(review.body, /déjà 3 avions en service/);
  assert.equal(runner.calls.some((c) => c.call.action === 'set-plan'), false, 'nothing runs on review');
  const bad = await b.post('/act/set-plan', { _csrf: csrf, server: 'alpha', slug: 'vexin', step: 'review', plan: 'ecole', maxAircraft: '2;reboot', maxMembers: '' });
  assert.equal(bad.statusCode, 400);
  const run = await b.post('/act/set-plan', { _csrf: csrf, server: 'alpha', slug: 'vexin', step: 'run', plan: 'ecole', maxAircraft: '2', maxMembers: '' });
  assert.equal(run.statusCode, 303, 'elevated by the sign-in a moment ago');
  await jobs.drain();
  const call = runner.calls.find((c) => c.call.action === 'set-plan')!.call;
  assert.deepEqual(call, { action: 'set-plan', slug: 'vexin', plan: 'ecole', maxAircraft: 2, maxMembers: null });
  const entries = db.prepare("SELECT action, outcome FROM audit WHERE action IN ('set-plan', 'set-plan.refused', 'job.set-plan')").all() as { action: string; outcome: string }[];
  assert.deepEqual(entries.map((e) => `${e.action}:${e.outcome}`).sort(), ['job.set-plan:ok', 'set-plan.refused:refused', 'set-plan:ok']);
});
