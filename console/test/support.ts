import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, type Config } from '../src/config.ts';
import { openDb, type Db } from '../src/db.ts';
import type { HelperRunner } from '../src/fleet.ts';
import type { HelperCall, RunResult } from '../src/servers/helper.ts';
import { createOwner } from '../src/security/auth.ts';

export const CONSOLE_DIR = fileURLToPath(new URL('..', import.meta.url));
export const DEPLOY_DIR = join(CONSOLE_DIR, '..', 'deploy');

export const KIT_FILES = [
  'clubs-remote.sh',
  'release-lib.sh',
  'new-club.sh',
  'docker-compose.yml',
  'docker-compose.behind-proxy.yml',
  'Caddyfile',
  'skycrew-backup.sh',
  'skycrew-watch.sh',
];

/** A kit like the one install.sh puts in /usr/local/lib/skycrew-console/kit. */
export const makeKit = (dir: string): string => {
  const kit = join(dir, 'kit');
  mkdirSync(kit, { recursive: true });
  for (const file of KIT_FILES) cpSync(join(DEPLOY_DIR, file), join(kit, file));
  cpSync(join(CONSOLE_DIR, 'helper', 'local-ssh'), join(kit, 'local-ssh'));
  return kit;
};

export const tempDir = (name: string): string => mkdtempSync(join(tmpdir(), `skycrew-console-${name}-`));

export const testConfig = (overrides: Record<string, string> = {}): Config =>
  loadConfig({
    CONSOLE_PUBLIC_URL: 'https://console.test',
    CONSOLE_SERVERS: 'alpha=local,beta=ssh:beta-host',
    CONSOLE_DB: ':memory:',
    STRIPE_WEBHOOK_SECRET: 'whsec_testsecret',
    ...overrides,
  });

export const TEST_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
export const TEST_PASSWORD = 'correct horse battery staple';

export const dbWithOwner = async (): Promise<{ db: Db; codes: string[] }> => {
  const db = openDb(':memory:');
  // A low scrypt cost keeps the tests fast; production uses 2^17.
  const codes = await createOwner(db, { username: 'owner', password: TEST_PASSWORD, totpSecret: TEST_SECRET }, Date.now(), 2 ** 10);
  return { db, codes };
};

/** A helper that answers from a table, and remembers every call. */
export const fakeRunner = (
  answer: (call: HelperCall, server: string) => Partial<RunResult> & { lines?: string[] },
): HelperRunner & { calls: { server: string; call: HelperCall }[] } => {
  const calls: { server: string; call: HelperCall }[] = [];
  const runner = (async (_config, server, call, options) => {
    calls.push({ server: server.name, call });
    const a = answer(call, server.name);
    const lines = a.lines ?? (a.output ?? '').split('\n').filter(Boolean);
    for (const line of lines) options?.onLine?.(line, 'out');
    return { code: a.code ?? 0, output: a.output ?? lines.join('\n'), timedOut: false };
  }) as HelperRunner & { calls: { server: string; call: HelperCall }[] };
  runner.calls = calls;
  return runner;
};

export const statusLines = (clubs: Record<string, Record<string, string>>, server: Record<string, string> = {}): string => {
  const s = { hostname: 'test', time: '2026-10-15 10:00', mem_total_mb: '16000', mem_avail_mb: '12000', cpus: '8', load1: '0.5', disk_total_mb: '200000', disk_avail_mb: '150000', ...server };
  const out = Object.entries(s).map(([k, v]) => `S\t${k}\t${v}`);
  for (const [slug, facts] of Object.entries(clubs)) for (const [k, v] of Object.entries(facts)) out.push(`C\t${slug}\t${k}\t${v}`);
  return out.join('\n');
};

export const healthyClub = (extra: Record<string, string> = {}): Record<string, string> => ({
  found: 'yes',
  url: 'https://club.example.fr',
  port: '8101',
  plan: 'club',
  max_aircraft: '5',
  max_members: '',
  env_backend: '2.18.0',
  env_frontend: '2.14.0',
  run_backend: '2.18.0',
  run_frontend: '2.14.0',
  svc_proxy: 'running -',
  svc_frontend: 'running healthy',
  svc_backend: 'running healthy',
  svc_db: 'running healthy',
  svc_redis: 'running -',
  local_ready: '200',
  members: '40',
  aircraft: '3',
  bookings30: '120',
  backup_installed: 'yes',
  backup_cron: 'yes',
  backup_age: 'fresh',
  backup_last: '2026-10-15 03:40',
  watch_installed: 'yes',
  watch_target: 'yes',
  watch_named: 'yes',
  watch_threshold: '2',
  watch_failures: '0',
  mem_mb: '700',
  db_kb: '50000',
  ...extra,
});

export const writeConf = (path: string, values: Record<string, string>): void =>
  writeFileSync(path, `${Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n')}\n`);
