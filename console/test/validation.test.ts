import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as v from '../src/validation.ts';
import { loadConfig, parseServers } from '../src/config.ts';

test('club names: the rules of new-club.sh', () => {
  assert.equal(v.clubSlug('aeroclub-vexin'), 'aeroclub-vexin');
  assert.equal(v.clubSlug(' abc '), 'abc');
  assert.equal(v.clubSlug('skycrew'), 'skycrew');
  assert.throws(() => v.clubSlug('skycrew', { allowFirst: false }), /réservé/);
  for (const bad of ['ab', 'Abc', '1abc', 'abc-', 'a_b', 'a b', 'abc;rm', '../etc', 'abc\nskycrew', 'a'.repeat(32), '', null, 42]) {
    assert.throws(() => v.clubSlug(bad), v.ValidationError, String(bad));
  }
});

test('versions, plans, caps', () => {
  assert.equal(v.version('2.18.0'), '2.18.0');
  for (const bad of ['2.18', 'v2.18.0', '2.18.0-rc1', '2.18.0;', 'latest', '']) assert.throws(() => v.version(bad));
  assert.equal(v.optionalVersion('', 'x'), null);
  assert.equal(v.plan('club'), 'club');
  assert.equal(v.plan('ecole'), 'ecole');
  assert.throws(() => v.plan('club-ecole'));
  assert.equal(v.cap('', 'x'), null);
  assert.equal(v.cap('12', 'x'), 12);
  for (const bad of ['0', '-1', '1.5', '100000', '1e3', ' 7a']) assert.throws(() => v.cap(bad, 'x'));
});

test('addresses, e-mails, webhooks, Stripe ids', () => {
  assert.equal(v.domain('Vexin.SkyCrew.fr'), 'vexin.skycrew.fr');
  for (const bad of ['https://vexin.skycrew.fr', 'vexin', 'vexin..fr', '-a.fr', 'a.fr/x', 'a.fr;id']) assert.throws(() => v.domain(bad), v.ValidationError, bad);
  assert.equal(v.email('president@aeroclub-vexin.fr'), 'president@aeroclub-vexin.fr');
  for (const bad of ['a@b', "o'brien@x.fr", 'a b@x.fr', 'a@x.fr\nb', '"a"@x.fr']) assert.throws(() => v.email(bad), v.ValidationError, bad);
  assert.equal(v.alertWebhook(''), null);
  assert.equal(v.alertWebhook('https://discord.com/api/webhooks/1/abc-DEF'), 'https://discord.com/api/webhooks/1/abc-DEF');
  for (const bad of ['http://x.fr/a', 'https://x.fr/a b', "https://x.fr/'", 'https://x.fr/$(id)']) assert.throws(() => v.alertWebhook(bad), v.ValidationError, bad);
  assert.equal(v.stripeSubscriptionId('sub_1PQRstuVWxyz'), 'sub_1PQRstuVWxyz');
  assert.throws(() => v.stripeSubscriptionId('cus_123456789'));
  assert.equal(v.planOfTier('club'), 'club');
  assert.equal(v.planOfTier('club-ecole'), 'ecole');
  assert.equal(v.planOfTier('other'), null);
});

test('settings: servers, loopback only, Stripe secret', () => {
  assert.deepEqual(parseServers('tickly-prod=local, autre=ssh:debian@1.2.3.4'), [
    { name: 'tickly-prod', kind: 'local' },
    { name: 'autre', kind: 'ssh', sshHost: 'debian@1.2.3.4' },
  ]);
  assert.throws(() => parseServers('x=ssh:host;rm'));
  assert.throws(() => loadConfig({ CONSOLE_HOST: '0.0.0.0' }), /127\.0\.0\.1/);
  assert.throws(() => loadConfig({ STRIPE_WEBHOOK_SECRET: 'sk_live_x' }), /whsec_/);
  assert.throws(() => loadConfig({ CONSOLE_SERVERS: 'a=local,a=local' }), /même nom/);
  const c = loadConfig({});
  assert.equal(c.host, '127.0.0.1');
  assert.equal(c.graceDays, 14);
  assert.equal(c.cookieSecure, true);
});
