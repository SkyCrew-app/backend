import { EntityManager } from 'typeorm';

// Money is counted in cents and rounded once, when an amount enters.
export const toCents = (amount: number | string): number =>
  Math.round(Number(amount) * 100);

export const fromCents = (cents: number): number => cents / 100;

// A strictly positive amount of euros with at most two decimals.
export const isPositiveMoney = (amount: unknown): amount is number => {
  const value = Number(amount);
  if (typeof amount !== 'number' || !Number.isFinite(value) || value <= 0) {
    return false;
  }
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
};

// One statement: the balance is read and written by the database, so two
// operations at the same moment cannot lose an update, and a debit that must
// not overdraw is refused by the same statement.
export const MOVE_BALANCE_SQL = `UPDATE "users" SET "user_account_balance" = "user_account_balance" + $1::numeric WHERE "id" = $2 RETURNING "user_account_balance"`;
export const MOVE_BALANCE_NOT_BELOW_ZERO_SQL = `UPDATE "users" SET "user_account_balance" = "user_account_balance" + $1::numeric WHERE "id" = $2 AND "user_account_balance" + $1::numeric >= 0 RETURNING "user_account_balance"`;

// Rows of an UPDATE … RETURNING, whichever shape the driver gives them in.
const returnedRows = (result: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(result)) return [];
  return Array.isArray(result[0]) ? result[0] : result;
};

// Adds `cents` (negative to debit) to a member's balance. Returns the new
// balance in cents, or null when nothing was changed: the member does not
// exist, or the debit would take the balance below zero.
export const moveBalance = async (
  manager: EntityManager,
  userId: number,
  cents: number,
  options: { notBelowZero: boolean },
): Promise<number | null> => {
  if (!Number.isInteger(cents)) {
    throw new Error('Invalid amount');
  }
  const rows = returnedRows(
    await manager.query(
      options.notBelowZero && cents < 0
        ? MOVE_BALANCE_NOT_BELOW_ZERO_SQL
        : MOVE_BALANCE_SQL,
      [fromCents(cents).toFixed(2), userId],
    ),
  );
  return rows.length > 0
    ? toCents(rows[0].user_account_balance as string)
    : null;
};

// Takes a row lock held until the end of the transaction: operations on the
// same row then run one after the other.
export const lockRow = async (
  manager: EntityManager,
  table: 'aircraft' | 'users' | 'reservations' | 'payments',
  id: number,
): Promise<boolean> => {
  const rows = await manager.query(
    `SELECT "id" FROM "${table}" WHERE "id" = $1 FOR NO KEY UPDATE`,
    [id],
  );
  return Array.isArray(rows) && rows.length > 0;
};
