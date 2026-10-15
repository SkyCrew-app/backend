import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

// One file, readable by the console's own user only. Each statement below
// runs once, in order; the version reached is kept in user_version.
const MIGRATIONS: string[] = [
  `CREATE TABLE owner (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     username TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     totp_secret TEXT NOT NULL,
     totp_last_step INTEGER,
     failed_count INTEGER NOT NULL DEFAULT 0,
     locked_until INTEGER,
     created_at INTEGER NOT NULL,
     password_changed_at INTEGER NOT NULL
   );
   CREATE TABLE recovery_codes (hash TEXT PRIMARY KEY, used_at INTEGER);
   CREATE TABLE sessions (
     id_hash TEXT PRIMARY KEY,
     csrf TEXT NOT NULL,
     stage TEXT NOT NULL CHECK (stage IN ('password', 'full')),
     created_at INTEGER NOT NULL,
     last_seen INTEGER NOT NULL,
     elevated_until INTEGER NOT NULL DEFAULT 0,
     ip TEXT NOT NULL,
     user_agent TEXT NOT NULL
   );
   CREATE TABLE login_failures (ip TEXT NOT NULL, at INTEGER NOT NULL);
   CREATE INDEX login_failures_ip ON login_failures (ip, at);
   CREATE TABLE audit (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     at INTEGER NOT NULL,
     actor TEXT NOT NULL,
     ip TEXT NOT NULL,
     action TEXT NOT NULL,
     target TEXT NOT NULL,
     details TEXT NOT NULL,
     outcome TEXT NOT NULL,
     prev_hash TEXT NOT NULL,
     hash TEXT NOT NULL
   );
   CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
   CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
   CREATE TABLE jobs (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     kind TEXT NOT NULL,
     server TEXT NOT NULL,
     slug TEXT,
     params TEXT NOT NULL,
     status TEXT NOT NULL,
     actor TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     started_at INTEGER,
     finished_at INTEGER,
     exit_code INTEGER,
     summary TEXT,
     parent_id INTEGER,
     cancel_requested INTEGER NOT NULL DEFAULT 0
   );
   CREATE INDEX jobs_status ON jobs (status);
   CREATE TABLE job_logs (job_id INTEGER NOT NULL, seq INTEGER NOT NULL, at INTEGER NOT NULL, line TEXT NOT NULL, PRIMARY KEY (job_id, seq));
   CREATE TABLE stripe_events (
     id TEXT PRIMARY KEY,
     type TEXT NOT NULL,
     created INTEGER NOT NULL,
     received_at INTEGER NOT NULL,
     livemode INTEGER NOT NULL,
     subscription TEXT,
     outcome TEXT NOT NULL
   );
   CREATE TABLE subscriptions (
     id TEXT PRIMARY KEY,
     customer TEXT,
     status TEXT NOT NULL,
     club_name TEXT,
     contact_name TEXT,
     contact_email TEXT,
     tier TEXT,
     cycle TEXT,
     aircraft INTEGER,
     livemode INTEGER NOT NULL,
     current_period_end INTEGER,
     cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
     unpaid_since INTEGER,
     last_event_created INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     server TEXT,
     slug TEXT,
     linked_at INTEGER
   );
   CREATE UNIQUE INDEX subscriptions_club ON subscriptions (server, slug) WHERE slug IS NOT NULL;
   CREATE TABLE club_state (
     server TEXT NOT NULL,
     slug TEXT NOT NULL,
     suspended_by TEXT CHECK (suspended_by IN ('owner', 'stripe')),
     suspended_at INTEGER,
     PRIMARY KEY (server, slug)
   );`,
];

export const openDb = (path: string): Db => {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  }
  const db = new DatabaseSync(path);
  if (path !== ':memory:') chmodSync(path, 0o600);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA secure_delete = ON;');
  const current = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  for (let i = current; i < MIGRATIONS.length; i++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return db;
};

export const now = (): number => Date.now();
