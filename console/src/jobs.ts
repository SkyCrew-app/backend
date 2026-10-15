import type { Config } from './config.ts';
import type { Db } from './db.ts';
import { recordAudit } from './audit.ts';
import type { Fleet, HelperRunner } from './fleet.ts';
import { runHelper, type HelperCall } from './servers/helper.ts';

// Long actions run in the background, one at a time per club, with their
// output kept line by line for the page that follows them.

export type JobKind = 'create' | 'enable-site' | 'set-plan' | 'suspend' | 'resume' | 'backup' | 'update' | 'update-all';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'rolled_back' | 'cancelled' | 'interrupted';

export interface Job {
  id: number;
  kind: JobKind;
  server: string;
  slug: string | null;
  params: Record<string, unknown>;
  status: JobStatus;
  actor: string;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  exitCode: number | null;
  summary: string | null;
  parentId: number | null;
  cancelRequested: boolean;
}

export interface LogLine {
  seq: number;
  at: number;
  line: string;
}

export const JOB_LABELS: Record<JobKind, string> = {
  create: 'Création du club',
  'enable-site': 'Activation du site (nginx + HTTPS)',
  'set-plan': 'Changement de formule',
  suspend: 'Suspension',
  resume: 'Réactivation',
  backup: 'Sauvegarde',
  update: 'Mise à jour',
  'update-all': 'Mise à jour de plusieurs clubs',
};

export const STATUS_LABELS: Record<JobStatus, string> = {
  queued: 'en attente',
  running: 'en cours',
  succeeded: 'réussi',
  failed: 'échec',
  rolled_back: 'échec, retour à l’ancienne version',
  cancelled: 'annulé',
  interrupted: 'interrompu',
};

const TIMEOUTS_MS: Record<JobKind, number> = {
  create: 20 * 60_000,
  'enable-site': 10 * 60_000,
  'set-plan': 10 * 60_000,
  suspend: 10 * 60_000,
  resume: 10 * 60_000,
  backup: 60 * 60_000,
  update: 40 * 60_000,
  'update-all': 0,
};

// Nothing secret or personal is kept in a job's output: e-mail addresses,
// keys, tokens and webhook addresses are masked before the line is stored.
export const redactLine = (line: string): string =>
  line
    .replace(/https:\/\/(discord(app)?\.com\/api\/webhooks|hooks\.slack\.com\/services)\/\S+/g, '[webhook masqué]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[e-mail masqué]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jeton masqué]')
    .replace(/\b(whsec|sk_live|sk_test|rk_live|rk_test)_[A-Za-z0-9]+/g, '[clé masquée]')
    .replace(/\b(sha256:)?[a-f0-9]{48,}\b/gi, '[empreinte masquée]')
    .replace(/\b([A-Z_]*(PASSWORD|SECRET|TOKEN|KEY)[A-Z_]*=)\S+/g, '$1[masqué]')
    .slice(0, 2000);

const PASSWORD_LINE = /^Mot de passe provisoire : (\S+)\s*$/;

interface Row {
  id: number;
  kind: JobKind;
  server: string;
  slug: string | null;
  params: string;
  status: JobStatus;
  actor: string;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
  exit_code: number | null;
  summary: string | null;
  parent_id: number | null;
  cancel_requested: number;
}

const toJob = (r: Row): Job => ({
  id: r.id,
  kind: r.kind,
  server: r.server,
  slug: r.slug,
  params: JSON.parse(r.params) as Record<string, unknown>,
  status: r.status,
  actor: r.actor,
  createdAt: r.created_at,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  exitCode: r.exit_code,
  summary: r.summary,
  parentId: r.parent_id,
  cancelRequested: r.cancel_requested === 1,
});

export interface UpdateTarget {
  server: string;
  slug: string;
}

export class Jobs {
  private readonly db: Db;
  private readonly config: Config;
  private readonly fleet: Fleet;
  private readonly run: HelperRunner;
  private readonly locks = new Set<string>();
  private readonly seq = new Map<number, number>();
  private readonly running = new Map<number, Promise<void>>();
  // Held in memory only, never in the database: the webhook of a club being
  // created, and the provisional password of its first administrator, shown once.
  private readonly webhooks = new Map<number, string>();
  private readonly passwords = new Map<number, { value: string; until: number }>();
  private timer: NodeJS.Timeout | null = null;
  private accepting = true;

  constructor(db: Db, config: Config, fleet: Fleet, run: HelperRunner = runHelper) {
    this.db = db;
    this.config = config;
    this.fleet = fleet;
    this.run = run;
    // A job cut by a restart of the console is reported as such, never retried.
    const cut = this.db.prepare("UPDATE jobs SET status = 'interrupted', finished_at = ?, summary = 'interrompu par un redémarrage de la console : vérifiez l’état du club' WHERE status = 'running'").run(Date.now());
    if (cut.changes) recordAudit(this.db, { actor: 'console', action: 'job.interrupted', details: { count: Number(cut.changes) }, outcome: 'warning' });
  }

  start(intervalMs = 500): void {
    this.timer ??= setInterval(() => this.tick(), intervalMs);
  }

  /** Takes no new job, then waits for the running ones (a switch is never cut in the middle). */
  async stop(): Promise<void> {
    this.accepting = false;
    // A multi-club update stops after the club in progress.
    this.db.prepare("UPDATE jobs SET cancel_requested = 1 WHERE status = 'running' AND kind = 'update-all'").run();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await Promise.allSettled([...this.running.values()]);
  }

  enqueue(input: {
    kind: JobKind;
    server: string;
    slug: string | null;
    params: Record<string, unknown>;
    actor: string;
    parentId?: number | null;
    status?: JobStatus;
    alertWebhook?: string | null;
  }): number {
    const result = this.db
      .prepare('INSERT INTO jobs (kind, server, slug, params, status, actor, created_at, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(input.kind, input.server, input.slug, JSON.stringify(input.params), input.status ?? 'queued', input.actor, Date.now(), input.parentId ?? null);
    const id = Number(result.lastInsertRowid);
    if (input.alertWebhook) this.webhooks.set(id, input.alertWebhook);
    return id;
  }

  get(id: number): Job | undefined {
    const row = this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Row | undefined;
    return row ? toJob(row) : undefined;
  }

  list(limit = 50): Job[] {
    return (this.db.prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT ?').all(limit) as unknown as Row[]).map(toJob);
  }

  children(id: number): Job[] {
    return (this.db.prepare('SELECT * FROM jobs WHERE parent_id = ? ORDER BY id').all(id) as unknown as Row[]).map(toJob);
  }

  forClub(server: string, slug: string, limit = 20): Job[] {
    return (this.db.prepare('SELECT * FROM jobs WHERE server = ? AND slug = ? ORDER BY id DESC LIMIT ?').all(server, slug, limit) as unknown as Row[]).map(toJob);
  }

  active(): Job[] {
    return (this.db.prepare("SELECT * FROM jobs WHERE status IN ('queued', 'running') ORDER BY id").all() as unknown as Row[]).map(toJob);
  }

  /** Whether a job of this club is waiting or running (for the Stripe rule). */
  pendingFor(server: string, slug: string, kinds: JobKind[]): boolean {
    return this.active().some((j) => j.server === server && j.slug === slug && kinds.includes(j.kind));
  }

  logAfter(id: number, after: number, limit = 500): LogLine[] {
    return this.db.prepare('SELECT seq, at, line FROM job_logs WHERE job_id = ? AND seq > ? ORDER BY seq LIMIT ?').all(id, after, limit) as unknown as LogLine[];
  }

  /** The provisional password of a club just created, once. */
  takePassword(id: number): string | null {
    const entry = this.passwords.get(id);
    this.passwords.delete(id);
    return entry && entry.until > Date.now() ? entry.value : null;
  }

  hasPassword(id: number): boolean {
    const entry = this.passwords.get(id);
    return entry !== undefined && entry.until > Date.now();
  }

  /** A waiting job is dropped; a multi-club update stops after the club in progress. */
  cancel(id: number): 'cancelled' | 'stopping' | 'not-cancellable' {
    const job = this.get(id);
    if (!job) return 'not-cancellable';
    if (job.status === 'queued') {
      const done = this.db.prepare("UPDATE jobs SET status = 'cancelled', finished_at = ?, summary = 'annulé avant de commencer' WHERE id = ? AND status = 'queued'").run(Date.now(), id);
      return done.changes ? 'cancelled' : 'not-cancellable';
    }
    if (job.status === 'running' && job.kind === 'update-all') {
      this.db.prepare('UPDATE jobs SET cancel_requested = 1 WHERE id = ?').run(id);
      return 'stopping';
    }
    return 'not-cancellable';
  }

  // --- Running ---------------------------------------------------------------------

  private log(id: number, line: string): void {
    let text = line.replace(/\r/g, '');
    const password = PASSWORD_LINE.exec(text);
    if (password) {
      this.passwords.set(id, { value: password[1], until: Date.now() + 30 * 60_000 });
      text = 'Mot de passe provisoire : affiché une seule fois en haut de cette page (jamais enregistré)';
    }
    const next = (this.seq.get(id) ?? (this.db.prepare('SELECT coalesce(max(seq), 0) AS n FROM job_logs WHERE job_id = ?').get(id) as { n: number }).n) + 1;
    this.seq.set(id, next);
    this.db.prepare('INSERT INTO job_logs (job_id, seq, at, line) VALUES (?, ?, ?, ?)').run(id, next, Date.now(), redactLine(text));
  }

  private keys(job: Job): string[] {
    if (job.kind === 'update-all') return ['update-all'];
    const club = `club:${job.server}:${job.slug}`;
    return job.kind === 'create' ? [`create:${job.server}`, club] : [club];
  }

  tick(): void {
    if (!this.accepting) return;
    for (const row of this.db.prepare("SELECT * FROM jobs WHERE status = 'queued' AND parent_id IS NULL ORDER BY id").all() as unknown as Row[]) {
      const job = toJob(row);
      const keys = this.keys(job);
      if (keys.some((k) => this.locks.has(k))) continue;
      keys.forEach((k) => this.locks.add(k));
      this.db.prepare("UPDATE jobs SET status = 'running', started_at = ? WHERE id = ?").run(Date.now(), job.id);
      const promise = this.execute(job)
        .catch((error: unknown) => {
          this.log(job.id, `erreur de la console : ${(error as Error).message}`);
          this.finish(job, 'failed', 1, 'erreur de la console');
        })
        .finally(() => {
          keys.forEach((k) => this.locks.delete(k));
          this.running.delete(job.id);
        });
      this.running.set(job.id, promise);
    }
  }

  /** Runs every waiting job to its end (tests). */
  async drain(): Promise<void> {
    for (;;) {
      this.tick();
      if (this.running.size === 0) return;
      await Promise.allSettled([...this.running.values()]);
    }
  }

  private finish(job: Job, status: JobStatus, code: number | null, summary: string): void {
    this.db.prepare('UPDATE jobs SET status = ?, finished_at = ?, exit_code = ?, summary = ? WHERE id = ?').run(status, Date.now(), code, summary, job.id);
    this.fleet.invalidate(job.server);
    recordAudit(this.db, {
      actor: job.actor,
      action: `job.${job.kind}`,
      target: job.slug ? `${job.server}:${job.slug}` : job.server,
      details: { job: job.id, status, code, summary },
      outcome: status === 'succeeded' ? 'ok' : 'failed',
    });
  }

  private call(job: Job): HelperCall {
    const p = job.params;
    const slug = job.slug ?? '';
    switch (job.kind) {
      case 'create':
        return {
          action: 'create',
          slug,
          domain: String(p.domain),
          adminEmail: String(p.adminEmail),
          plan: p.plan as 'club' | 'ecole',
          maxAircraft: (p.maxAircraft as number | null) ?? null,
          maxMembers: (p.maxMembers as number | null) ?? null,
          backend: String(p.backend),
          frontend: String(p.frontend),
          alertWebhook: this.webhooks.get(job.id) ?? null,
        };
      case 'set-plan':
        return { action: 'set-plan', slug, plan: p.plan as 'club' | 'ecole', maxAircraft: (p.maxAircraft as number | null) ?? null, maxMembers: (p.maxMembers as number | null) ?? null };
      case 'update':
        return { action: 'update', slug, backend: (p.backend as string | null) ?? null, frontend: (p.frontend as string | null) ?? null };
      case 'enable-site':
      case 'suspend':
      case 'resume':
      case 'backup':
        return { action: job.kind, slug };
      default:
        throw new Error(`action ${job.kind} sans appel direct`);
    }
  }

  private async runOne(job: Job): Promise<{ status: JobStatus; code: number; summary: string }> {
    const server = this.fleet.server(job.server);
    if (!server) return { status: 'failed', code: 64, summary: 'serveur inconnu' };
    if (job.kind === 'create' && job.params.hasWebhook && !this.webhooks.has(job.id)) {
      this.log(job.id, 'le webhook d’alerte a été perdu au redémarrage de la console : le club est créé sans (à ajouter ensuite)');
    }
    let updateResult = '';
    let suspendedAnswer = '';
    const result = await this.run(this.config, server, this.call(job), {
      timeoutMs: TIMEOUTS_MS[job.kind],
      onLine: (line) => {
        const u = /^UPDATE_RESULT=(\w+)/.exec(line);
        if (u) updateResult = u[1];
        const s = /^SUSPENDED_ANSWER=(\w+)/.exec(line);
        if (s) suspendedAnswer = s[1];
        this.log(job.id, line);
      },
    });
    this.webhooks.delete(job.id);
    if (result.timedOut) this.log(job.id, 'trop long : arrêté par la console');
    return this.outcome(job, result.code, updateResult, suspendedAnswer);
  }

  private outcome(job: Job, code: number, updateResult: string, suspendedAnswer: string): { status: JobStatus; code: number; summary: string } {
    const slug = job.slug ?? '';
    if (code === 75) return { status: 'failed', code, summary: 'une autre opération était en cours sur ce club : rien n’a été fait, relancez plus tard' };
    if (code === 64) return { status: 'failed', code, summary: 'argument refusé par l’outil du serveur : rien n’a été fait' };
    if (code === 5) return { status: 'failed', code, summary: 'image absente du serveur : rien n’a été fait (voir « Images » dans le README)' };
    switch (job.kind) {
      case 'update':
        if (code === 0) return { status: 'succeeded', code, summary: `${slug} mis à jour` };
        if (code === 1 || updateResult === 'rolled_back')
          return { status: 'rolled_back', code, summary: 'les nouvelles versions ne répondaient pas : le club est revenu tout seul à ses versions précédentes, qui tournent' };
        if (code === 2) return { status: 'failed', code, summary: 'ni les nouvelles ni les anciennes versions ne répondent : À VÉRIFIER TOUT DE SUITE' };
        if (code === 3) return { status: 'failed', code, summary: 'rien n’a été changé (sauvegarde ou configuration refusée)' };
        return { status: 'failed', code, summary: `interrompu (code ${code}) : vérifiez l’état du club` };
      case 'suspend':
        if (code === 0) return { status: 'succeeded', code, summary: 'club suspendu : ses membres voient « service suspendu », données intactes' };
        if (code === 4 || suspendedAnswer === 'unknown')
          return { status: 'failed', code, summary: 'suspension sans effet : la version du club est trop ancienne (backend 2.19.0 ou plus récent nécessaire)' };
        return { status: 'failed', code, summary: `suspension non confirmée (code ${code})` };
      case 'resume':
        return code === 0 ? { status: 'succeeded', code, summary: 'club réactivé' } : { status: 'failed', code, summary: `réactivation non confirmée (code ${code})` };
      default:
        return code === 0
          ? { status: 'succeeded', code, summary: `${JOB_LABELS[job.kind]} : terminé` }
          : { status: 'failed', code, summary: `${JOB_LABELS[job.kind]} : échec (code ${code}), voir le journal` };
    }
  }

  private recordSuspension(job: Job, status: JobStatus): void {
    if (status !== 'succeeded' || !job.slug) return;
    if (job.kind === 'suspend') {
      this.db
        .prepare('INSERT INTO club_state (server, slug, suspended_by, suspended_at) VALUES (?, ?, ?, ?) ON CONFLICT (server, slug) DO UPDATE SET suspended_by = excluded.suspended_by, suspended_at = excluded.suspended_at')
        .run(job.server, job.slug, job.actor === 'stripe' ? 'stripe' : 'owner', Date.now());
    } else if (job.kind === 'resume') {
      this.db.prepare('DELETE FROM club_state WHERE server = ? AND slug = ?').run(job.server, job.slug);
    }
  }

  private async execute(job: Job): Promise<void> {
    if (job.kind === 'update-all') return this.executeUpdateAll(job);
    this.log(job.id, `${JOB_LABELS[job.kind]} : ${job.slug ?? ''} sur ${job.server}`);
    const { status, code, summary } = await this.runOne(job);
    this.recordSuspension(job, status);
    this.finish(job, status, code, summary);
  }

  private async executeUpdateAll(job: Job): Promise<void> {
    const targets = (job.params.targets as UpdateTarget[]) ?? [];
    const backend = (job.params.backend as string | null) ?? null;
    const frontend = (job.params.frontend as string | null) ?? null;
    const continueOnError = job.params.continueOnError === true;
    const done: string[] = [];
    const failed: string[] = [];
    const skipped: string[] = [];
    let stop = false;
    for (const target of targets) {
      const name = `${target.slug} (${target.server})`;
      if (stop || this.get(job.id)?.cancelRequested) {
        skipped.push(name);
        continue;
      }
      const club = await this.fleet.club(target.server, target.slug, true);
      if (!club) {
        this.log(job.id, `${name} : introuvable, passé`);
        skipped.push(name);
        continue;
      }
      if ((!backend || club.facts.env_backend === backend) && (!frontend || club.facts.env_frontend === frontend)) {
        this.log(job.id, `${name} : déjà dans ces versions, rien à faire`);
        continue;
      }
      const key = `club:${target.server}:${target.slug}`;
      while (this.locks.has(key)) await new Promise((r) => setTimeout(r, 1000));
      this.locks.add(key);
      try {
        const childId = this.enqueue({ kind: 'update', server: target.server, slug: target.slug, params: { backend, frontend }, actor: job.actor, parentId: job.id, status: 'running' });
        this.db.prepare('UPDATE jobs SET started_at = ? WHERE id = ?').run(Date.now(), childId);
        const child = this.get(childId)!;
        this.log(job.id, `== ${name} : sauvegarde, bascule, attente de bonne santé (journal : opération n° ${childId})`);
        this.log(childId, `Mise à jour : ${target.slug} sur ${target.server}`);
        const result = await this.runOne(child);
        this.finish(child, result.status, result.code, result.summary);
        this.log(job.id, `${name} : ${result.summary}`);
        if (result.status === 'succeeded') done.push(name);
        else {
          failed.push(name);
          if (!continueOnError) stop = true;
        }
      } finally {
        this.locks.delete(key);
      }
    }
    const summary = `mis à jour : ${done.length ? done.join(', ') : 'aucun'} ; en échec : ${failed.length ? failed.join(', ') : 'aucun'} ; pas tentés : ${skipped.length ? skipped.join(', ') : 'aucun'}`;
    this.log(job.id, `Bilan — ${summary}`);
    const status: JobStatus = failed.length ? 'failed' : this.get(job.id)?.cancelRequested && skipped.length ? 'cancelled' : 'succeeded';
    this.finish(job, status, failed.length ? 1 : 0, summary);
  }
}
