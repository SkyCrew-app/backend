import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { Fleet } from '../src/fleet.ts';
import { Jobs } from '../src/jobs.ts';
import { applyPaymentRule, handleStripeWebhook, linkSubscription, subscriptionOf, suspendedBy } from '../src/stripe.ts';
import { buildApp } from '../src/web/server.ts';
import { dbWithOwner, fakeRunner, healthyClub, statusLines, testConfig } from './support.ts';

const SECRET = 'whsec_testsecret';
const stripe = new Stripe('sk_test_unused');
const DAY = 86_400_000;

let counter = 0;
const event = (type: string, object: Record<string, unknown>, created: number, previous?: Record<string, unknown>) => ({
  id: `evt_${++counter}`,
  object: 'event',
  type,
  created: Math.floor(created / 1000),
  livemode: false,
  api_version: '2025-01-27.acacia',
  data: { object, ...(previous ? { previous_attributes: previous } : {}) },
});

const signed = (payload: string, secret = SECRET) => stripe.webhooks.generateTestHeaderString({ payload, secret });

const subscription = (status: string, extra: Record<string, unknown> = {}) => ({
  id: 'sub_TESTabcdef123',
  object: 'subscription',
  status,
  customer: 'cus_123',
  livemode: false,
  cancel_at_period_end: false,
  metadata: { tier: 'club-ecole', cycle: 'yearly', aircraft: '4', club_name: 'Aéroclub du Vexin', contact_name: 'Jeanne', contact_email: 'jeanne@vexin.fr', language: 'fr' },
  items: { data: [{ quantity: 1, current_period_end: 1_900_000_000 }, { quantity: 4, current_period_end: 1_900_000_000 }] },
  ...extra,
});

const setup = async () => {
  const { db } = await dbWithOwner();
  const config = testConfig({ CONSOLE_SERVERS: 'alpha=local', STRIPE_GRACE_DAYS: '14' });
  const runner = fakeRunner((call) => {
    if (call.action === 'status') return { output: statusLines({ vexin: healthyClub() }) };
    if (call.action === 'suspend') return { lines: ['SUSPENDED_ANSWER=true', 'club suspendu'] };
    if (call.action === 'resume') return { lines: ['SUSPENDED_ANSWER=false', 'club réactivé'] };
    return {};
  });
  const fleet = new Fleet(config, runner, async () => '200');
  const jobs = new Jobs(db, config, fleet, runner);
  return { db, config, runner, jobs, fleet };
};

const deliver = (db: Parameters<typeof handleStripeWebhook>[0], e: ReturnType<typeof event>, at: number) => {
  const payload = JSON.stringify(e);
  return handleStripeWebhook(db, payload, signed(payload), SECRET, at);
};

test('only notifications signed with the endpoint secret are read', async () => {
  const { db } = await setup();
  const payload = JSON.stringify(event('customer.subscription.created', subscription('active'), Date.now()));
  assert.equal(handleStripeWebhook(db, payload, signed(payload, 'whsec_other'), SECRET).status, 400);
  assert.equal(handleStripeWebhook(db, payload, undefined, SECRET).status, 400);
  assert.equal(handleStripeWebhook(db, payload, signed(payload), null).status, 503);
  assert.equal(handleStripeWebhook(db, `${payload} `, signed(payload), SECRET).status, 400, 'body changed after signing');
  const old = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET, timestamp: Math.floor(Date.now() / 1000) - 3600 });
  assert.equal(handleStripeWebhook(db, payload, old, SECRET).status, 400, 'replayed an hour later');
  assert.equal(subscriptionOf(db, 'sub_TESTabcdef123'), undefined);
  assert.equal(handleStripeWebhook(db, payload, signed(payload), SECRET).status, 200);
  const sub = subscriptionOf(db, 'sub_TESTabcdef123')!;
  assert.equal(sub.club_name, 'Aéroclub du Vexin');
  assert.equal(sub.tier, 'club-ecole');
  assert.equal(sub.aircraft, 4);
  assert.equal(sub.status, 'active');
  assert.equal(handleStripeWebhook(db, payload, signed(payload), SECRET).body.duplicate, true, 'same event twice');
});

test('cancellation: the linked club is suspended after the grace period, then reactivated on payment', async () => {
  const { db, jobs, runner, config } = await setup();
  const t0 = Date.UTC(2026, 9, 1);
  deliver(db, event('checkout.session.completed', { id: 'cs_1', object: 'checkout.session', subscription: 'sub_TESTabcdef123', metadata: subscription('active').metadata, customer_details: { email: 'jeanne@vexin.fr' } }, t0), t0);
  deliver(db, event('customer.subscription.created', subscription('trialing'), t0), t0);
  linkSubscription(db, 'sub_TESTabcdef123', 'alpha', 'vexin');

  const cancelledAt = t0 + 20 * DAY;
  deliver(db, event('customer.subscription.deleted', subscription('canceled'), cancelledAt), cancelledAt);
  assert.equal(subscriptionOf(db, 'sub_TESTabcdef123')!.unpaid_since, Math.floor(cancelledAt / 1000) * 1000);

  assert.deepEqual(applyPaymentRule(db, jobs, config.graceDays, cancelledAt + 13 * DAY), [], 'still within the 14 days');
  const [suspendJob] = applyPaymentRule(db, jobs, config.graceDays, cancelledAt + 14 * DAY + 1000);
  assert.ok(suspendJob);
  assert.deepEqual(applyPaymentRule(db, jobs, config.graceDays, cancelledAt + 14 * DAY + 2000), [], 'not twice');
  await jobs.drain();
  assert.equal(jobs.get(suspendJob)!.status, 'succeeded');
  assert.equal(jobs.get(suspendJob)!.actor, 'stripe');
  assert.equal(suspendedBy(db, 'alpha', 'vexin'), 'stripe');
  assert.deepEqual(runner.calls.filter((c) => c.call.action === 'suspend').map((c) => c.call), [{ action: 'suspend', slug: 'vexin' }]);

  // The club takes a new subscription... here the same one comes back to active after paying.
  const paidAt = cancelledAt + 20 * DAY;
  deliver(db, event('invoice.paid', { id: 'in_1', object: 'invoice', parent: { subscription_details: { subscription: 'sub_TESTabcdef123' } } }, paidAt), paidAt);
  deliver(db, event('customer.subscription.updated', subscription('active'), paidAt + 1000), paidAt + 1000);
  const [resumeJob] = applyPaymentRule(db, jobs, config.graceDays, paidAt + 2000);
  assert.ok(resumeJob);
  await jobs.drain();
  assert.equal(jobs.get(resumeJob)!.status, 'succeeded');
  assert.equal(suspendedBy(db, 'alpha', 'vexin'), null);
});

test('failed payments: past_due counts from the first failure; payment in time cancels the suspension', async () => {
  const { db, jobs, config } = await setup();
  const t0 = Date.UTC(2026, 9, 1);
  deliver(db, event('customer.subscription.created', subscription('active'), t0), t0);
  linkSubscription(db, 'sub_TESTabcdef123', 'alpha', 'vexin');
  const failedAt = t0 + 30 * DAY;
  deliver(db, event('invoice.payment_failed', { id: 'in_2', object: 'invoice', subscription: 'sub_TESTabcdef123' }, failedAt), failedAt);
  deliver(db, event('customer.subscription.updated', subscription('past_due'), failedAt + 5000), failedAt + 5000);
  assert.equal(subscriptionOf(db, 'sub_TESTabcdef123')!.unpaid_since, Math.floor(failedAt / 1000) * 1000, 'the first failure starts the clock');
  // Paid on day 10: nothing happens on day 15.
  deliver(db, event('customer.subscription.updated', subscription('active'), failedAt + 10 * DAY), failedAt + 10 * DAY);
  assert.deepEqual(applyPaymentRule(db, jobs, config.graceDays, failedAt + 15 * DAY), []);
});

test('notifications out of order: an older one does not undo a newer one', async () => {
  const { db } = await setup();
  const t = Date.UTC(2026, 9, 1);
  deliver(db, event('customer.subscription.updated', subscription('active'), t + 60_000), t + 60_000);
  deliver(db, event('customer.subscription.updated', subscription('past_due'), t), t + 70_000);
  assert.equal(subscriptionOf(db, 'sub_TESTabcdef123')!.status, 'active');
});

test('a club suspended by hand is never reactivated by Stripe; unlinked subscriptions touch nothing', async () => {
  const { db, jobs, config } = await setup();
  const t = Date.UTC(2026, 9, 1);
  deliver(db, event('customer.subscription.created', subscription('active'), t), t);
  db.prepare("INSERT INTO club_state (server, slug, suspended_by, suspended_at) VALUES ('alpha', 'vexin', 'owner', ?)").run(t);
  linkSubscription(db, 'sub_TESTabcdef123', 'alpha', 'vexin');
  assert.deepEqual(applyPaymentRule(db, jobs, config.graceDays, t + DAY), []);
  linkSubscription(db, 'sub_TESTabcdef123', null, null);
  deliver(db, event('customer.subscription.deleted', subscription('canceled'), t + DAY), t + DAY);
  assert.deepEqual(applyPaymentRule(db, jobs, config.graceDays, t + 60 * DAY), []);
});

test('the webhook address of the console, over HTTP, without session or CSRF', async () => {
  const { db, config, fleet, jobs } = await setup();
  const app = await buildApp({ config, db, fleet, jobs });
  const payload = JSON.stringify(event('customer.subscription.created', subscription('active'), Date.now()));
  const ok = await app.inject({ method: 'POST', url: '/stripe/webhook', headers: { 'content-type': 'application/json', 'stripe-signature': signed(payload) }, payload });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(ok.json(), { received: true });
  const forged = await app.inject({ method: 'POST', url: '/stripe/webhook', headers: { 'content-type': 'application/json', 'stripe-signature': signed(payload, 'whsec_x') }, payload });
  assert.equal(forged.statusCode, 400);
});
