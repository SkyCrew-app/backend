// Every value that reaches a club installation goes through here first. The
// privileged helper checks the same rules again (helper/skycrew-console-helper):
// a value refused here never reaches it, a value accepted here may still be
// refused there.

export type Plan = 'club' | 'ecole';

export class ValidationError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(message);
    this.field = field;
  }
}

const SLUG = /^[a-z][a-z0-9-]{1,29}[a-z0-9]$/;
const VERSION = /^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,6}$/;
const DOMAIN = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;
const CAP = /^[1-9][0-9]{0,4}$/;
const SERVER = /^[a-z0-9][a-z0-9-]{0,30}$/;
const STRIPE_SUB = /^sub_[A-Za-z0-9]{8,64}$/;
const WEBHOOK = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?\/[A-Za-z0-9._~\/?=&%+-]{0,400}$/;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// A new club: the first installation is named "skycrew" and keeps that name.
export const clubSlug = (value: unknown, { allowFirst = true } = {}): string => {
  const slug = text(value);
  if (slug === 'skycrew' && allowFirst) return slug;
  if (slug === 'skycrew') {
    throw new ValidationError('slug', 'Le nom « skycrew » est réservé au premier club installé.');
  }
  if (!SLUG.test(slug)) {
    throw new ValidationError(
      'slug',
      'Le nom court fait 3 à 31 caractères : lettres minuscules, chiffres et tirets, en commençant par une lettre.',
    );
  }
  return slug;
};

export const version = (value: unknown, field = 'version'): string => {
  const v = text(value);
  if (!VERSION.test(v)) throw new ValidationError(field, 'Une version s’écrit comme 2.18.0.');
  return v;
};

// Empty: "do not change this one".
export const optionalVersion = (value: unknown, field: string): string | null =>
  text(value) === '' ? null : version(value, field);

export const domain = (value: unknown): string => {
  const d = text(value).toLowerCase().replace(/\.$/, '');
  if (!DOMAIN.test(d)) {
    throw new ValidationError('domain', 'Donnez l’adresse du club sans https:// (par exemple vexin.skycrew.fr).');
  }
  return d;
};

export const email = (value: unknown, field = 'email'): string => {
  const e = text(value);
  if (e.length > 254 || !EMAIL.test(e)) throw new ValidationError(field, 'Adresse e-mail invalide.');
  return e;
};

export const plan = (value: unknown): Plan => {
  const p = text(value);
  if (p !== 'club' && p !== 'ecole') throw new ValidationError('plan', 'La formule est « club » ou « ecole ».');
  return p;
};

// Empty: no limit.
export const cap = (value: unknown, field: string): number | null => {
  const c = text(value);
  if (c === '') return null;
  if (!CAP.test(c)) throw new ValidationError(field, 'Une limite est un nombre entier entre 1 et 99999, ou vide.');
  return Number(c);
};

export const serverName = (value: unknown): string => {
  const s = text(value);
  if (!SERVER.test(s)) throw new ValidationError('server', 'Serveur inconnu.');
  return s;
};

export const stripeSubscriptionId = (value: unknown): string => {
  const s = text(value);
  if (!STRIPE_SUB.test(s)) throw new ValidationError('subscription', 'Identifiant d’abonnement Stripe invalide.');
  return s;
};

export const alertWebhook = (value: unknown): string | null => {
  const w = text(value);
  if (w === '') return null;
  if (w.length > 500 || !WEBHOOK.test(w)) {
    throw new ValidationError('alertWebhook', 'Le webhook d’alerte doit être une adresse https:// complète.');
  }
  return w;
};

export const positiveInt = (value: unknown, field: string, max = 1_000_000): number => {
  const n = text(value);
  if (!/^[0-9]{1,7}$/.test(n) || Number(n) < 1 || Number(n) > max) {
    throw new ValidationError(field, `Nombre entier attendu (1 à ${max}).`);
  }
  return Number(n);
};

export const totpCode = (value: unknown): string => {
  const c = text(value).replace(/\s/g, '');
  if (!/^[0-9]{6}$/.test(c)) throw new ValidationError('code', 'Le code fait 6 chiffres.');
  return c;
};

// The Stripe tiers of the marketing site, as plans of the application.
export const planOfTier = (tier: string | null | undefined): Plan | null =>
  tier === 'club' ? 'club' : tier === 'club-ecole' ? 'ecole' : null;
