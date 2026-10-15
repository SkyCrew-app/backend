// Settings of the console, read from the environment. In production systemd
// loads them from /etc/skycrew-console/console.env (see deploy/console.env.example).

export interface ServerConfig {
  name: string;
  kind: 'local' | 'ssh';
  // For ssh: what is typed after `ssh` (a name from ~/.ssh/config, or user@host).
  sshHost?: string;
}

export interface Config {
  host: string;
  port: number;
  publicUrl: string;
  dbPath: string;
  servers: ServerConfig[];
  // Command running the privileged helper on this machine (local servers).
  helperCommand: string[];
  // Command reaching a remote server, and the helper there (ssh servers).
  sshCommand: string[];
  remoteHelperCommand: string[];
  stripeWebhookSecret: string | null;
  graceDays: number;
  cookieSecure: boolean;
  sessionIdleMinutes: number;
  sessionMaxHours: number;
  elevationMinutes: number;
  statusTtlSeconds: number;
  // Whether nginx in front of the console sets X-Forwarded-For (loopback only).
  trustProxy: boolean;
}

const words = (value: string): string[] => value.trim().split(/\s+/).filter(Boolean);

export const parseServers = (value: string): ServerConfig[] =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^([a-z0-9][a-z0-9-]{0,30})=(local|ssh:([A-Za-z0-9@._-]{1,100}))$/.exec(part);
      if (!match) throw new Error(`CONSOLE_SERVERS : « ${part} » doit s’écrire nom=local ou nom=ssh:hôte`);
      return match[2] === 'local'
        ? { name: match[1], kind: 'local' as const }
        : { name: match[1], kind: 'ssh' as const, sshHost: match[3] };
    });

export const loadConfig = (env: Record<string, string | undefined> = process.env): Config => {
  const num = (key: string, fallback: number, min = 1, max = 1_000_000): number => {
    const raw = env[key];
    if (raw === undefined || raw.trim() === '') return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${key} doit être un nombre entier entre ${min} et ${max}`);
    return n;
  };
  const host = env.CONSOLE_HOST?.trim() || '127.0.0.1';
  // The console holds root-level powers: it only ever listens on the loopback
  // interface, behind nginx.
  if (!['127.0.0.1', '::1', 'localhost'].includes(host)) {
    throw new Error('CONSOLE_HOST doit être 127.0.0.1 : la console ne s’expose qu’à travers nginx');
  }
  const publicUrl = (env.CONSOLE_PUBLIC_URL?.trim() || `http://127.0.0.1:${num('CONSOLE_PORT', 8090)}`).replace(/\/$/, '');
  if (!/^https?:\/\/[A-Za-z0-9.-]+(:[0-9]+)?$/.test(publicUrl)) throw new Error('CONSOLE_PUBLIC_URL : une origine, comme https://console.example.fr');
  const servers = parseServers(env.CONSOLE_SERVERS ?? 'local=local');
  if (servers.length === 0) throw new Error('CONSOLE_SERVERS : au moins un serveur');
  if (new Set(servers.map((s) => s.name)).size !== servers.length) throw new Error('CONSOLE_SERVERS : deux serveurs ont le même nom');
  const secret = env.STRIPE_WEBHOOK_SECRET?.trim() || null;
  if (secret && !/^whsec_[A-Za-z0-9]+$/.test(secret)) throw new Error('STRIPE_WEBHOOK_SECRET commence par whsec_');
  return {
    host,
    port: num('CONSOLE_PORT', 8090, 1024, 65535),
    publicUrl,
    dbPath: env.CONSOLE_DB?.trim() || '/var/lib/skycrew-console/console.db',
    servers,
    helperCommand: words(env.CONSOLE_HELPER ?? 'sudo -n /usr/local/sbin/skycrew-console-helper'),
    sshCommand: words(env.CONSOLE_SSH ?? 'ssh -o BatchMode=yes -o ConnectTimeout=10'),
    remoteHelperCommand: words(env.CONSOLE_REMOTE_HELPER ?? 'sudo -n /usr/local/sbin/skycrew-console-helper'),
    stripeWebhookSecret: secret,
    graceDays: num('STRIPE_GRACE_DAYS', 14, 1, 90),
    cookieSecure: env.CONSOLE_COOKIE_SECURE !== '0',
    sessionIdleMinutes: num('CONSOLE_SESSION_IDLE_MINUTES', 30, 5, 240),
    sessionMaxHours: num('CONSOLE_SESSION_MAX_HOURS', 8, 1, 24),
    elevationMinutes: num('CONSOLE_ELEVATION_MINUTES', 5, 1, 30),
    statusTtlSeconds: num('CONSOLE_STATUS_TTL_SECONDS', 60, 5, 3600),
    trustProxy: env.CONSOLE_TRUST_PROXY !== '0',
  };
};
