import { EntityManager } from 'typeorm';
import { clubMoment } from '../reservations/booking-rules';

// Invoice numbers: one sequence per calendar year (club time), without
// gaps, written "2026-00042".
export const INVOICE_NUMBER_DIGITS = 5;

export const formatInvoiceNumber = (year: number, sequence: number): string =>
  `${year}-${String(sequence).padStart(INVOICE_NUMBER_DIGITS, '0')}`;

export const invoiceYear = (date: Date): number =>
  Number(clubMoment(date).day.slice(0, 4));

// One statement creates the year's counter or raises it, and returns the
// number taken. It holds the counter's row until the caller's transaction
// ends: two invoices never get the same number, and a transaction that
// fails gives its number back, so the sequence has no gap.
export const NEXT_INVOICE_NUMBER_SQL = `INSERT INTO "invoice_sequences" ("year", "last_number") VALUES ($1, 1) ON CONFLICT ("year") DO UPDATE SET "last_number" = "invoice_sequences"."last_number" + 1 RETURNING "last_number"`;

// The invoices of a member of the showcase club (src/db/showcase) take the
// showcase's own series ("DEMO-2026-00042"): the club's sequence never gives
// a number that removing the showcase would leave as a gap. Returns no row
// for any other member, or when no showcase exists.
export const SHOWCASE_INVOICE_NUMBER_SQL = `UPDATE "showcase_state" SET "invoice_last_number" = "invoice_last_number" + 1 WHERE "id" = 1 AND EXISTS (SELECT 1 FROM "showcase_items" WHERE "entity" = 'users' AND "row_id" = $1::text) RETURNING "invoice_prefix", "invoice_last_number"`;

export const formatShowcaseInvoiceNumber = (
  prefix: string,
  year: number,
  sequence: number,
): string => `${prefix}-${formatInvoiceNumber(year, sequence)}`;

const showcaseInvoiceNumber = async (
  manager: EntityManager,
  memberId: number,
  year: number,
): Promise<string | null> => {
  const result = await manager.query(SHOWCASE_INVOICE_NUMBER_SQL, [
    String(memberId),
  ]);
  const rows = Array.isArray(result?.[0]) ? result[0] : result;
  const sequence = Number(rows?.[0]?.invoice_last_number);
  const prefix = rows?.[0]?.invoice_prefix;
  return typeof prefix === 'string' && Number.isInteger(sequence)
    ? formatShowcaseInvoiceNumber(prefix, year, sequence)
    : null;
};

// The next number of the year of `date`. Must be called with the manager of
// the transaction that inserts the invoice. `memberId` is the member the
// invoice is for.
export const nextInvoiceNumber = async (
  manager: EntityManager,
  date: Date = new Date(),
  memberId?: number | null,
): Promise<string> => {
  const year = invoiceYear(date);
  if (memberId != null) {
    const showcase = await showcaseInvoiceNumber(manager, memberId, year);
    if (showcase) {
      return showcase;
    }
  }
  const result = await manager.query(NEXT_INVOICE_NUMBER_SQL, [year]);
  const rows = Array.isArray(result?.[0]) ? result[0] : result;
  const sequence = Number(rows?.[0]?.last_number);
  if (!Number.isInteger(sequence) || sequence <= 0) {
    throw new Error('Invoice number could not be assigned');
  }
  return formatInvoiceNumber(year, sequence);
};

// What an invoice is for, stored with it (invoices.invoice_items) so the
// document can be written later, in any language.
export type InvoiceLine =
  | {
      kind: 'booking';
      amount: number;
      reservationId?: number | null;
      registration?: string | null;
      start?: string | null;
      end?: string | null;
      // Name of the instructor on board, for an instruction flight.
      instructor?: string | null;
    }
  | { kind: 'top_up'; amount: number; method?: string | null }
  | { kind: 'other'; amount: number; label?: string | null };

export const parseInvoiceLines = (
  stored: string | null | undefined,
): InvoiceLine[] => {
  if (!stored) {
    return [];
  }
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((line) => line && typeof line.kind === 'string')
      : [];
  } catch {
    // Free text typed by an administrator: one line, as it is.
    return [{ kind: 'other', amount: 0, label: stored }];
  }
};
