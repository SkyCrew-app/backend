import type { Config, ServerConfig } from './config.ts';
import { runHelper, type HelperCall, type RunResult } from './servers/helper.ts';
import { evaluateClub, evaluateServer, parseStatus, type ClubStatus, type ServerStatus } from './servers/status.ts';

export type HelperRunner = (
  config: Config,
  server: ServerConfig,
  call: HelperCall,
  options?: Parameters<typeof runHelper>[3],
) => Promise<RunResult>;

export type UrlChecker = (url: string) => Promise<string>;

// The public address of a club is checked from here, as a member would.
export const checkPublicUrl: UrlChecker = async (url) => {
  if (!/^https?:\/\/[A-Za-z0-9.-]+(:[0-9]+)?\/?$/.test(url)) return '000';
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/health/ready`, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
    return String(response.status);
  } catch {
    return '000';
  }
};

export interface Images {
  backend: string[];
  frontend: string[];
}

const byVersion = (a: string, b: string): number => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i];
  return 0;
};

/** What every server says, kept a short while (the helper takes a few seconds per server). */
export class Fleet {
  private readonly cache = new Map<string, ServerStatus>();
  private readonly inflight = new Map<string, Promise<ServerStatus>>();
  private readonly config: Config;
  private readonly run: HelperRunner;
  private readonly checkUrl: UrlChecker;

  constructor(config: Config, run: HelperRunner = runHelper, checkUrl: UrlChecker = checkPublicUrl) {
    this.config = config;
    this.run = run;
    this.checkUrl = checkUrl;
  }

  get servers(): ServerConfig[] {
    return this.config.servers;
  }

  server(name: string): ServerConfig | undefined {
    return this.config.servers.find((s) => s.name === name);
  }

  invalidate(server?: string): void {
    if (server) this.cache.delete(server);
    else this.cache.clear();
  }

  cached(name: string): ServerStatus | undefined {
    return this.cache.get(name);
  }

  async status(name: string, force = false): Promise<ServerStatus> {
    const fresh = this.cache.get(name);
    if (!force && fresh && Date.now() - fresh.fetchedAt < this.config.statusTtlSeconds * 1000) return fresh;
    const running = this.inflight.get(name);
    if (running) return running;
    const promise = this.fetchStatus(name).finally(() => this.inflight.delete(name));
    this.inflight.set(name, promise);
    return promise;
  }

  async all(force = false): Promise<ServerStatus[]> {
    return Promise.all(this.config.servers.map((s) => this.status(s.name, force)));
  }

  async club(server: string, slug: string, force = false): Promise<ClubStatus | undefined> {
    return (await this.status(server, force)).clubs.find((c) => c.slug === slug);
  }

  async images(name: string): Promise<Images> {
    const server = this.server(name);
    const images: Images = { backend: [], frontend: [] };
    if (!server) return images;
    const result = await this.run(this.config, server, { action: 'images' }, { timeoutMs: 30_000 });
    if (result.code !== 0) return images;
    for (const line of result.output.split('\n')) {
      const [kind, version] = line.split('\t');
      if ((kind === 'backend' || kind === 'frontend') && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(version ?? '')) images[kind].push(version);
    }
    images.backend.sort(byVersion);
    images.frontend.sort(byVersion);
    return images;
  }

  private async fetchStatus(name: string): Promise<ServerStatus> {
    const server = this.server(name);
    const at = Date.now();
    if (!server) return evaluateServer(name, {}, [], at, 'serveur inconnu');
    const result = await this.run(this.config, server, { action: 'status' }, { timeoutMs: 120_000 });
    if (result.code !== 0) {
      const status = evaluateServer(name, {}, [], at, result.output.trim().split('\n').slice(-2).join(' ').slice(0, 200) || `code ${result.code}`);
      this.cache.set(name, status);
      return status;
    }
    const parsed = parseStatus(result.output);
    const entries = [...parsed.clubs.entries()];
    await Promise.all(
      entries.map(async ([, facts]) => {
        if (facts.url) facts.domain_ready = await this.checkUrl(facts.url);
      }),
    );
    const clubs = entries.map(([slug, facts]) => evaluateClub(name, slug, facts)).sort((a, b) => a.slug.localeCompare(b.slug));
    const status = evaluateServer(name, parsed.server, clubs, at);
    this.cache.set(name, status);
    return status;
  }
}

export { byVersion };
