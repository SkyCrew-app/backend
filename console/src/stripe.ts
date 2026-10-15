import Stripe from 'stripe';
import type { Db } from './db.ts';
import { recordAudit } from './audit.ts';
import type { Jobs } from './jobs.ts';
import { planOfTier } from './validation.ts';

// Subscriptions taken on the marketing site (Stripe Checkout, see
// landing/src/lib/stripe.ts): the console learns them from Stripe's signed
// notifications only. It holds no Stripe key, only the signing secret of its
// webhook endpoint, so it can read what Stripe says and nothing more.
//
// OWNER RULE (suspension of unpaid clubs), chosen 2026-10-15:
//   - a subscription stops paying when Stripe says it is past_due, unpaid,
//     canceled, incomplete_expired or paused, or when an invoice fails;
//   - its club is suspended automatically GRACE days (14 by default,
//     STRIPE_GRACE_DAYS) after that first moment, if it has not paid since.
//     14 days lets Stripe's automatic payment retries (spread over about two
//     weeks with the default settings) and a late bank transfer go through,
//     and leaves time for a word with the club;
//   - as soon as Stripe says it is active (or trialing) again, a club the rule
//     suspended is reactivated automatically. A club the owner suspended by
//     hand is never reactivated by Stripe;
//   - suspension deletes nothing: members see "service suspendu", the data
//     stays as it is.

export const PAYING = new Set(['active', 'trialing']);
export const NOT_PAYING = new Set(['past_due', 'unpaid', 'canceled', 'incomplete_expired', 'paused']);

export const HANDLED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
  'invoice.paid',
] as const;

export const STATUS_FR: Record<string, string> = {
  trialing: 'période d’essai',
  active: 'actif',
  past_due: 'paiement en retard',
  unpaid: 'impayé',
  canceled: 'résilié',
  incomplete: 'paiement à finaliser',
  incomplete_expired: 'paiement non finalisé',
  paused: 'en pause',
};

export interface Subscription {
  id: string;
  customer: string | null;
  status: string;
  club_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  tier: string | null;
  cycle: string | null;
  aircraft: number | null;
  livemode: number;
  current_period_end: number | null;
  cancel_at_period_end: number;
  unpaid_since: number | null;
  last_event_created: number;
  updated_at: number;
  server: string | null;
  slug: string | null;
  linked_at: number | null;
}

// Any client can check a signature: no call is made to Stripe.
const verifier = new Stripe('sk_test_signature_check_only');

const idOf = (value: unknown): string | null =>
  typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value ? String((value as { id: unknown }).id) : null;

const text = (value: unknown, max = 200): string | null => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);

export const listSubscriptions = (db: Db): Subscription[] =>
  db.prepare('SELECT * FROM subscriptions ORDER BY updated_at DESC').all() as unknown as Subscription[];

export const subscriptionOf = (db: Db, id: string): Subscription | undefined =>
  db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id) as Subscription | undefined;

export const subscriptionForClub = (db: Db, server: string, slug: string): Subscription | undefined =>
  db.prepare('SELECT * FROM subscriptions WHERE server = ? AND slug = ?').get(server, slug) as Subscription | undefined;

const ensureRow = (db: Db, id: string, livemode: boolean, at: number): void => {
  db.prepare(
    "INSERT INTO subscriptions (id, status, livemode, last_event_created, updated_at) VALUES (?, 'incomplete', ?, 0, ?) ON CONFLICT (id) DO NOTHING",
  ).run(id, livemode ? 1 : 0, at);
};

const setMetadata = (db: Db, id: string, metadata: Record<string, string> | null | undefined, at: number): void => {
  const m = metadata ?? {};
  const aircraft = /^[0-9]{1,4}$/.test(m.aircraft ?? '') ? Number(m.aircraft) : null;
  db.prepare(
    `UPDATE subscriptions SET
       club_name = coalesce(?, club_name), contact_name = coalesce(?, contact_name), contact_email = coalesce(?, contact_email),
       tier = coalesce(?, tier), cycle = coalesce(?, cycle), aircraft = coalesce(?, aircraft), updated_at = ?
     WHERE id = ?`,
  ).run(text(m.club_name), text(m.contact_name), text(m.contact_email), text(m.tier, 40), text(m.cycle, 20), aircraft, at, id);
};

const applySubscription = (db: Db, sub: Stripe.Subscription, eventCreated: number, at: number): string => {
  ensureRow(db, sub.id, sub.livemode, at);
  const row = subscriptionOf(db, sub.id)!;
  // Stripe does not promise the order of its notifications: an older one is ignored.
  if (eventCreated < row.last_event_created) return 'older event ignored';
  setMetadata(db, sub.id, sub.metadata, at);
  const items = sub.items?.data ?? [];
  const aircraftItem = items.find((item) => (item.quantity ?? 1) > 1) ?? items[1];
  const periodEnd =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    (items[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end ??
    null;
  let unpaidSince = row.unpaid_since;
  if (PAYING.has(sub.status)) unpaidSince = null;
  else if (NOT_PAYING.has(sub.status) && unpaidSince === null) unpaidSince = eventCreated * 1000;
  db.prepare(
    `UPDATE subscriptions SET status = ?, customer = ?, aircraft = coalesce(?, aircraft), current_period_end = ?, cancel_at_period_end = ?,
       unpaid_since = ?, last_event_created = ?, updated_at = ? WHERE id = ?`,
  ).run(
    sub.status,
    idOf(sub.customer),
    aircraftItem?.quantity ?? null,
    periodEnd,
    sub.cancel_at_period_end ? 1 : 0,
    unpaidSince,
    eventCreated,
    at,
    sub.id,
  );
  return `status ${sub.status}`;
};

const invoiceSubscription = (invoice: Stripe.Invoice): string | null => {
  const legacy = idOf((invoice as unknown as { subscription?: unknown }).subscription);
  if (legacy) return legacy;
  const parent = (invoice as unknown as { parent?: { subscription_details?: { subscription?: unknown } } }).parent;
  return idOf(parent?.subscription_details?.subscription);
};

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

/** Checks the signature, records the event once, updates the subscription. */
export const handleStripeWebhook = (
  db: Db,
  payload: Buffer | string,
  signature: string | undefined,
  secret: string | null,
  at = Date.now(),
  ip = '-',
): WebhookResult => {
  if (!secret) return { status: 503, body: { error: 'webhook not configured' } };
  if (!signature) return { status: 400, body: { error: 'missing signature' } };
  let event: Stripe.Event;
  try {
    event = verifier.webhooks.constructEvent(payload, signature, secret, 300);
  } catch {
    recordAudit(db, { actor: 'stripe', ip, action: 'stripe.webhook', details: { error: 'invalid signature' }, outcome: 'refused' });
    return { status: 400, body: { error: 'invalid signature' } };
  }
  if (db.prepare('SELECT 1 FROM stripe_events WHERE id = ?').get(event.id)) return { status: 200, body: { received: true, duplicate: true } };

  let subscription: string | null = null;
  let outcome = 'ignored';
  db.exec('BEGIN');
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        subscription = idOf(session.subscription);
        if (subscription) {
          ensureRow(db, subscription, event.livemode, at);
          setMetadata(db, subscription, session.metadata, at);
          if (!subscriptionOf(db, subscription)?.contact_email && session.customer_details?.email) {
            db.prepare('UPDATE subscriptions SET contact_email = ? WHERE id = ?').run(session.customer_details.email.slice(0, 200), subscription);
          }
          outcome = 'checkout recorded';
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        subscription = sub.id;
        outcome = applySubscription(db, sub, event.created, at);
        break;
      }
      case 'invoice.payment_failed': {
        subscription = invoiceSubscription(event.data.object as Stripe.Invoice);
        if (subscription) {
          ensureRow(db, subscription, event.livemode, at);
          db.prepare('UPDATE subscriptions SET unpaid_since = coalesce(unpaid_since, ?), updated_at = ? WHERE id = ?').run(event.created * 1000, at, subscription);
          outcome = 'payment failed';
        }
        break;
      }
      case 'invoice.paid': {
        subscription = invoiceSubscription(event.data.object as Stripe.Invoice);
        if (subscription) {
          ensureRow(db, subscription, event.livemode, at);
          const row = subscriptionOf(db, subscription)!;
          // A paid invoice settles the debt, unless the subscription has ended since.
          if (!NOT_PAYING.has(row.status) || row.status === 'past_due' || row.status === 'unpaid') {
            db.prepare(
              "UPDATE subscriptions SET unpaid_since = NULL, status = CASE WHEN status IN ('past_due', 'unpaid', 'incomplete') THEN 'active' ELSE status END, updated_at = ? WHERE id = ?",
            ).run(at, subscription);
          }
          outcome = 'invoice paid';
        }
        break;
      }
    }
    db.prepare('INSERT INTO stripe_events (id, type, created, received_at, livemode, subscription, outcome) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      event.id,
      event.type,
      event.created,
      at,
      event.livemode ? 1 : 0,
      subscription,
      outcome,
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  recordAudit(db, { actor: 'stripe', ip, action: `stripe.${event.type}`, target: subscription ?? '-', details: { event: event.id, outcome, livemode: event.livemode } }, at);
  return { status: 200, body: { received: true } };
};

export const recentEvents = (db: Db, limit = 30) =>
  db.prepare('SELECT * FROM stripe_events ORDER BY received_at DESC LIMIT ?').all(limit) as unknown as {
    id: string;
    type: string;
    created: number;
    received_at: number;
    livemode: number;
    subscription: string | null;
    outcome: string;
  }[];

export const linkSubscription = (db: Db, id: string, server: string | null, slug: string | null, at = Date.now()): void => {
  db.exec('BEGIN');
  try {
    if (server && slug) db.prepare('UPDATE subscriptions SET server = NULL, slug = NULL, linked_at = NULL WHERE server = ? AND slug = ?').run(server, slug);
    db.prepare('UPDATE subscriptions SET server = ?, slug = ?, linked_at = ? WHERE id = ?').run(server, slug, server ? at : null, id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

export const suspensionDue = (sub: Subscription, graceDays: number): number | null =>
  sub.unpaid_since === null ? null : sub.unpaid_since + graceDays * 86_400_000;

export const suspendedBy = (db: Db, server: string, slug: string): 'owner' | 'stripe' | null =>
  ((db.prepare('SELECT suspended_by FROM club_state WHERE server = ? AND slug = ?').get(server, slug) as { suspended_by: 'owner' | 'stripe' } | undefined)?.suspended_by ?? null);

/**
 * The rule above, applied to every subscription linked to a club. Returns the
 * jobs it queued. A failed automatic action is tried again 6 hours later at most.
 */
export const applyPaymentRule = (db: Db, jobs: Jobs, graceDays: number, at = Date.now()): number[] => {
  const queued: number[] = [];
  const recentlyTried = (server: string, slug: string, kind: string): boolean =>
    db.prepare("SELECT 1 FROM jobs WHERE server = ? AND slug = ? AND kind = ? AND actor = 'stripe' AND created_at > ?").get(server, slug, kind, at - 6 * 3_600_000) !==
    undefined;
  for (const sub of listSubscriptions(db)) {
    if (!sub.server || !sub.slug) continue;
    if (jobs.pendingFor(sub.server, sub.slug, ['suspend', 'resume'])) continue;
    const by = suspendedBy(db, sub.server, sub.slug);
    const due = suspensionDue(sub, graceDays);
    if (due !== null && at >= due && by === null) {
      if (recentlyTried(sub.server, sub.slug, 'suspend')) continue;
      const id = jobs.enqueue({ kind: 'suspend', server: sub.server, slug: sub.slug, params: { reason: 'stripe', subscription: sub.id }, actor: 'stripe' });
      recordAudit(db, { actor: 'stripe', action: 'club.suspend.auto', target: `${sub.server}:${sub.slug}`, details: { subscription: sub.id, status: sub.status, unpaidSince: sub.unpaid_since, job: id } }, at);
      queued.push(id);
    } else if (due === null && PAYING.has(sub.status) && by === 'stripe') {
      if (recentlyTried(sub.server, sub.slug, 'resume')) continue;
      const id = jobs.enqueue({ kind: 'resume', server: sub.server, slug: sub.slug, params: { reason: 'stripe', subscription: sub.id }, actor: 'stripe' });
      recordAudit(db, { actor: 'stripe', action: 'club.resume.auto', target: `${sub.server}:${sub.slug}`, details: { subscription: sub.id, status: sub.status, job: id } }, at);
      queued.push(id);
    }
  }
  return queued;
};

/** The suggested settings of a club for a subscription (plan and aircraft cap). */
export const clubSettingsOf = (sub: Subscription): { plan: 'club' | 'ecole' | null; maxAircraft: number | null } => ({
  plan: planOfTier(sub.tier),
  maxAircraft: sub.aircraft && sub.aircraft > 0 ? sub.aircraft : null,
});
