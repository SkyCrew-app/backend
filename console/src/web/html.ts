// Server-rendered pages: every value put in a page is escaped, unless it is
// itself a piece of page built here (Html).

export class Html {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
  toString(): string {
    return this.value;
  }
}

export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const piece = (value: unknown): string => {
  if (value instanceof Html) return value.value;
  if (Array.isArray(value)) return value.map(piece).join('');
  if (value === null || value === undefined || value === false) return '';
  return escapeHtml(value);
};

export const html = (strings: TemplateStringsArray, ...values: unknown[]): Html =>
  new Html(strings.reduce((out, s, i) => out + s + (i < values.length ? piece(values[i]) : ''), ''));

export const raw = (value: string): Html => new Html(value);

const pad = (n: number): string => String(n).padStart(2, '0');

/** 15/10/2026 14:05, in the time of Paris. */
export const dateTime = (ms: number | null | undefined): string => {
  if (!ms) return '—';
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(new Date(ms));
};

export const date = (ms: number | null | undefined): string =>
  ms ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short' }).format(new Date(ms)) : '—';

export const duration = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${pad(s % 60)} s`;
};

export const sizeMb = (mb: number | string | undefined): string => {
  if (mb === undefined || mb === '') return '?';
  const n = Number(mb);
  return n < 1024 ? `${Math.round(n)} Mo` : `${(n / 1024).toFixed(1).replace('.', ',')} Go`;
};

export const sizeKb = (kb: number | string | undefined): string => {
  if (kb === undefined || kb === '') return '?';
  const n = Number(kb);
  if (n < 1024) return `${Math.round(n)} Ko`;
  return sizeMb(n / 1024);
};
