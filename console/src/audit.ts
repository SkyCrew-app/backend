import { createHash } from 'node:crypto';
import type { Db } from './db.ts';

export interface AuditEntry {
  id: number;
  at: number;
  actor: string;
  ip: string;
  action: string;
  target: string;
  details: string;
  outcome: string;
  prev_hash: string;
  hash: string;
}

// Append-only: the table refuses UPDATE and DELETE (triggers), and each entry
// carries the hash of the one before, so that an entry removed or changed by
// hand in the file shows as a broken chain. Every entry is also written to the
// system journal (standard output), outside the database.
export const recordAudit = (
  db: Db,
  entry: { actor: string; ip?: string; action: string; target?: string; details?: Record<string, unknown> | string; outcome?: string },
  at = Date.now(),
): AuditEntry => {
  const details = typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details ?? {});
  const last = db.prepare('SELECT hash FROM audit ORDER BY id DESC LIMIT 1').get() as { hash: string } | undefined;
  const prev = last?.hash ?? 'genesis';
  const row = {
    at,
    actor: entry.actor,
    ip: entry.ip ?? '-',
    action: entry.action,
    target: entry.target ?? '-',
    details,
    outcome: entry.outcome ?? 'ok',
  };
  const hash = createHash('sha256').update(prev).update(JSON.stringify(row)).digest('hex');
  const result = db
    .prepare('INSERT INTO audit (at, actor, ip, action, target, details, outcome, prev_hash, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(row.at, row.actor, row.ip, row.action, row.target, row.details, row.outcome, prev, hash);
  if (process.env.NODE_ENV !== 'test' && !process.env.NODE_TEST_CONTEXT) {
    process.stdout.write(`audit ${new Date(at).toISOString()} ${row.actor} ${row.ip} ${row.action} ${row.target} ${row.outcome} ${details}\n`);
  }
  return { id: Number(result.lastInsertRowid), ...row, prev_hash: prev, hash };
};

export const listAudit = (db: Db, limit = 200, beforeId?: number): AuditEntry[] =>
  db
    .prepare('SELECT * FROM audit WHERE id < ? ORDER BY id DESC LIMIT ?')
    .all(beforeId ?? Number.MAX_SAFE_INTEGER, limit) as unknown as AuditEntry[];

// Whether every entry still follows the one before.
export const verifyAuditChain = (db: Db): { ok: boolean; brokenAt: number | null } => {
  let prev = 'genesis';
  for (const e of db.prepare('SELECT * FROM audit ORDER BY id').all() as unknown as AuditEntry[]) {
    const row = { at: e.at, actor: e.actor, ip: e.ip, action: e.action, target: e.target, details: e.details, outcome: e.outcome };
    const hash = createHash('sha256').update(prev).update(JSON.stringify(row)).digest('hex');
    if (e.prev_hash !== prev || e.hash !== hash) return { ok: false, brokenAt: e.id };
    prev = e.hash;
  }
  return { ok: true, brokenAt: null };
};
