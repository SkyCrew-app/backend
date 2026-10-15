import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import formbody from '@fastify/formbody';
import type { Config } from '../config.ts';
import type { Db } from '../db.ts';
import { listAudit, recordAudit, verifyAuditChain } from '../audit.ts';
import type { Fleet } from '../fleet.ts';
import type { Jobs, UpdateTarget } from '../jobs.ts';
import { STATUS_LABELS } from '../jobs.ts';
import {
  checkPassword,
  checkSecondStep,
  csrfMatches,
  elevate,
  endSession,
  getSession,
  isElevated,
  ownerName,
  recoveryCodesLeft,
  setPassword,
  touchSession,
  type Refusal,
  type Session,
  type SessionPolicy,
} from '../security/auth.ts';
import { verifyPassword } from '../security/password.ts';
import {
  applyPaymentRule,
  handleStripeWebhook,
  linkSubscription,
  listSubscriptions,
  recentEvents,
  subscriptionForClub,
  subscriptionOf,
  suspendedBy,
  clubSettingsOf,
} from '../stripe.ts';
import * as v from '../validation.ts';
import { html, type Html } from './html.ts';
import { page } from './layout.ts';
import * as pages from './pages.ts';


const PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));
const STATIC: Record<string, { type: string; body: Buffer }> = {
  'console.css': { type: 'text/css; charset=utf-8', body: readFileSync(`${PUBLIC_DIR}console.css`) },
  'console.js': { type: 'text/javascript; charset=utf-8', body: readFileSync(`${PUBLIC_DIR}console.js`) },
};

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ');

type Body = Record<string, string | string[] | undefined>;

export interface AppDeps {
  config: Config;
  db: Db;
  fleet: Fleet;
  jobs: Jobs;
  // Tests: a fixed clock.
  now?: () => number;
}

const refusalText = (r: Refusal): string => {
  const minutes = Math.max(1, Math.ceil((r.until - Date.now()) / 60_000));
  return r.reason === 'ip'
    ? `Trop d’essais depuis cette adresse : réessayez dans ${minutes} minute(s).`
    : `Compte bloqué après trop d’essais : réessayez dans ${minutes} minute(s), ou débloquez-le sur le serveur (skycrew-console unlock).`;
};

const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? '') : (value ?? ''));
const all = (value: string | string[] | undefined): string[] => (Array.isArray(value) ? value : value ? [value] : []);

export const buildApp = async (deps: AppDeps): Promise<FastifyInstance> => {
  const { config, db, fleet, jobs } = deps;
  const now = deps.now ?? Date.now;
  const policy: SessionPolicy = { idleMinutes: config.sessionIdleMinutes, maxHours: config.sessionMaxHours, elevationMinutes: config.elevationMinutes };
  const cookieName = config.cookieSecure ? '__Host-skycrew_console' : 'skycrew_console';
  const preCookieName = config.cookieSecure ? '__Host-skycrew_console_pre' : 'skycrew_console_pre';

  const app = Fastify({
    logger: false,
    bodyLimit: 512 * 1024,
    // nginx on the same machine: the visitor's address comes in X-Forwarded-For.
    trustProxy: config.trustProxy ? ['127.0.0.1', '::1'] : false,
    routerOptions: { ignoreTrailingSlash: true },
  });
  await app.register(formbody, { bodyLimit: 64 * 1024 });
  // Stripe signs the exact bytes it sends: they are kept as they are.
  app.addContentTypeParser('application/json', { parseAs: 'buffer', bodyLimit: 512 * 1024 }, (_req, body, done) => done(null, body));

  // --- Every answer -----------------------------------------------------------------
  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Content-Security-Policy', CSP);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    // same-origin, not no-referrer: with no-referrer browsers send "Origin: null"
    // on form posts, which the origin check below must refuse.
    reply.header('Referrer-Policy', 'same-origin');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Cross-Origin-Resource-Policy', 'same-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    reply.header('Cache-Control', 'no-store');
    if (config.cookieSecure) reply.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  });

  // --- Cookies and sessions -----------------------------------------------------------
  const cookies = (request: FastifyRequest): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const part of (request.headers.cookie ?? '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
  };
  const setCookie = (reply: FastifyReply, name: string, value: string, maxAgeSeconds: number) => {
    const attributes = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSeconds}`];
    if (config.cookieSecure) attributes.push('Secure');
    reply.header('Set-Cookie', attributes.join('; '));
  };
  const sessionOf = (request: FastifyRequest): Session | null => getSession(db, cookies(request)[cookieName], policy, now());
  const ua = (request: FastifyRequest): string => String(request.headers['user-agent'] ?? '').slice(0, 200);

  // Every POST from a page must come from a page of the console.
  const sameOrigin = (request: FastifyRequest): boolean => {
    const origin = request.headers.origin;
    if (typeof origin === 'string') return origin === config.publicUrl;
    const referer = request.headers.referer;
    return typeof referer === 'string' && (referer === config.publicUrl || referer.startsWith(`${config.publicUrl}/`));
  };

  const send = (reply: FastifyReply, status: number, body: string) => reply.code(status).type('text/html; charset=utf-8').send(body);

  const render = (
    reply: FastifyReply,
    session: Session | null,
    title: string,
    body: Html,
    current = '',
    flash: { kind: 'ok' | 'error' | 'warn'; text: string } | null = null,
    status = 200,
  ) =>
    send(
      reply,
      status,
      page({ title, body, flash, nav: session && session.stage === 'full' ? { current, csrf: session.csrf, owner: ownerName(db) ?? '' } : undefined }),
    );

  const flashOf = (request: FastifyRequest): { kind: 'ok' | 'error' | 'warn'; text: string } | null => {
    const q = request.query as Record<string, string>;
    const messages: Record<string, { kind: 'ok' | 'error' | 'warn'; text: string }> = {
      queued: { kind: 'ok', text: 'Opération lancée : elle apparaît ci-dessous.' },
      linked: { kind: 'ok', text: 'Abonnement relié.' },
      password: { kind: 'ok', text: 'Mot de passe changé : reconnectez-vous.' },
      expired: { kind: 'warn', text: 'Session terminée : reconnectez-vous.' },
      refreshed: { kind: 'ok', text: 'État actualisé.' },
    };
    return messages[q.m ?? ''] ?? null;
  };

  /** A signed-in owner, or a redirection to the sign-in page. */
  const guard = async (request: FastifyRequest, reply: FastifyReply): Promise<Session | null> => {
    const session = sessionOf(request);
    if (!session || session.stage !== 'full') {
      if (request.method === 'GET' && !request.url.endsWith('.json')) {
        reply.redirect(`/login${session ? '' : '?m=expired'}`, 303);
      } else {
        reply.code(401).type('application/json').send({ error: 'signed out' });
      }
      return null;
    }
    if (request.method === 'POST') {
      const body = (request.body ?? {}) as Body;
      if (!sameOrigin(request) || !csrfMatches(session, first(body._csrf))) {
        recordAudit(db, { actor: ownerName(db) ?? 'owner', ip: request.ip, action: 'csrf.refused', target: request.url, outcome: 'refused' });
        send(reply, 403, page({ title: 'Refusé', body: pages.errorPage(403, 'Requête refusée (jeton de sécurité absent ou périmé). Rechargez la page et recommencez.') }));
        return null;
      }
    }
    if (!request.url.endsWith('.json')) touchSession(db, session, now());
    return session;
  };

  // --- Static files, health ---------------------------------------------------------
  app.get('/static/:file', async (request, reply) => {
    const file = STATIC[(request.params as { file: string }).file];
    if (!file) return reply.code(404).send();
    return reply.header('Cache-Control', 'public, max-age=3600').type(file.type).send(file.body);
  });
  app.get('/healthz', async (_request, reply) => reply.type('text/plain').send('ok'));

  // --- Signing in ---------------------------------------------------------------------
  const prePage = (reply: FastifyReply, error: string | null, status = 200) => {
    const pre = randomBytes(24).toString('base64url');
    setCookie(reply, preCookieName, pre, 600);
    return send(reply, status, page({ title: 'Connexion', body: pages.loginPage(pre, error) }));
  };

  app.get('/login', async (request, reply) => {
    const session = sessionOf(request);
    if (session?.stage === 'full') return reply.redirect('/', 303);
    return prePage(reply, (request.query as Record<string, string>).m === 'expired' ? 'Session terminée : reconnectez-vous.' : null);
  });

  app.post('/login', async (request, reply) => {
    const body = (request.body ?? {}) as Body;
    const pre = cookies(request)[preCookieName] ?? '';
    const sent = first(body._csrf);
    const preOk = pre.length > 0 && sent.length === pre.length && timingSafeEqual(Buffer.from(sent), Buffer.from(pre));
    if (!sameOrigin(request) || !preOk) return prePage(reply, 'La page de connexion a expiré : recommencez.', 403);
    const username = first(body.username).slice(0, 64);
    const result = await checkPassword(db, { username, password: first(body.password).slice(0, 300), ip: request.ip, userAgent: ua(request) }, now());
    if (!result.ok) {
      recordAudit(db, { actor: username || '?', ip: request.ip, action: 'login.password', outcome: 'refused', details: { refusal: result.refusal?.reason ?? null, lockedNow: !!result.lockedNow } });
      return prePage(reply, result.refusal ? refusalText(result.refusal) : result.lockedNow ? refusalText({ reason: 'account', until: now() + 15 * 60_000 }) : 'Identifiant ou mot de passe incorrect.', 401);
    }
    setCookie(reply, cookieName, result.token, 300);
    return reply.redirect('/login/code', 303);
  });

  app.get('/login/code', async (request, reply) => {
    const session = sessionOf(request);
    if (!session) return reply.redirect('/login?m=expired', 303);
    if (session.stage === 'full') return reply.redirect('/', 303);
    return send(reply, 200, page({ title: 'Code de vérification', body: pages.codePage(session.csrf, null) }));
  });

  app.post('/login/code', async (request, reply) => {
    const session = sessionOf(request);
    if (!session || session.stage !== 'password') return reply.redirect('/login?m=expired', 303);
    const body = (request.body ?? {}) as Body;
    if (!sameOrigin(request) || !csrfMatches(session, first(body._csrf))) return reply.redirect('/login?m=expired', 303);
    const result = checkSecondStep(db, session, { code: first(body.code).slice(0, 30), ip: request.ip, userAgent: ua(request) }, policy, now());
    if (!result.ok) {
      recordAudit(db, { actor: ownerName(db) ?? '?', ip: request.ip, action: 'login.code', outcome: 'refused', details: { refusal: result.refusal?.reason ?? null } });
      const message = result.refusal ? refusalText(result.refusal) : 'Code incorrect, ou déjà utilisé.';
      return send(reply, 401, page({ title: 'Code de vérification', body: pages.codePage(session.csrf, message) }));
    }
    recordAudit(db, { actor: ownerName(db) ?? 'owner', ip: request.ip, action: 'login', details: { recoveryCodeUsed: !!result.recoveryUsed } });
    setCookie(reply, cookieName, result.token, policy.maxHours * 3600);
    return reply.redirect('/', 303);
  });

  app.post('/logout', async (request, reply) => {
    const session = await guard(request, reply);
    if (!session) return reply;
    endSession(db, session);
    recordAudit(db, { actor: ownerName(db) ?? 'owner', ip: request.ip, action: 'logout' });
    setCookie(reply, cookieName, '', 0);
    return reply.redirect('/login', 303);
  });

  // --- Stripe notifications (signed by Stripe, no session) ------------------------------
  app.post('/stripe/webhook', async (request, reply) => {
    const raw = Buffer.isBuffer(request.body) ? request.body : Buffer.from(typeof request.body === 'string' ? request.body : '');
    const signature = request.headers['stripe-signature'];
    const result = handleStripeWebhook(db, raw, typeof signature === 'string' ? signature : undefined, config.stripeWebhookSecret, now(), request.ip);
    if (result.status === 200 && !result.body.duplicate) applyPaymentRule(db, jobs, config.graceDays, now());
    return reply.code(result.status).type('application/json').send(result.body);
  });

  // --- Pages --------------------------------------------------------------------------
  app.get('/', async (request, reply) => {
    const session = await guard(request, reply);
    if (!session) return reply;
    const servers = await fleet.all();
    const subscriptions = new Map(listSubscriptions(db).filter((s) => s.slug).map((s) => [`${s.server}:${s.slug}`, s]));
    const unlinked = listSubscriptions(db).filter((s) => !s.slug && s.status !== 'canceled' && s.status !== 'incomplete_expired').length;
    return render(reply, session, 'Clubs', pages.dashboardPage({ csrf: session.csrf, servers, subscriptions, graceDays: config.graceDays, active: jobs.active(), unlinked }), '/', flashOf(request));
  });

  app.post('/refresh', async (request, reply) => {
    const session = await guard(request, reply);
    if (!session) return reply;
    await fleet.all(true);
    return reply.redirect('/?m=refreshed', 303);
  });

  app.get('/clubs/:server/:slug', async (request, reply) => {
    const session = await guard(request, reply);
    if (!session) return reply;
    const { server, slug } = request.params as { server: string; slug: string };
    let club;
    try {
      club = fleet.server(v.serverName(server)) ? await fleet.club(server, v.clubSlug(slug)) : undefined;
    } catch {
      club = undefined;
    }
    if (!club) return render(reply, session, 'Introuvable', pages.errorPage(404, 'Ce club n’existe pas (ou le serveur ne répond pas).'), '', null, 404);
    return render(
      reply,
      session,
      club.slug,
      pages.clubPage({
        csrf: session.csrf,
        club,
        images: await fleet.images(server),
        subscription: subscriptionForClub(db, server, club.slug),
        suspendedBy: suspendedBy(db, server, club.slug),
        graceDays: config.graceDays,
        jobs: jobs.forClub(server, club.slug),
      }),
      '',
      flashOf(request),
    );
  });

  const newClubForm = async (session: Session, values: pages.NewClubValues, error: string | null = null) => {
    const servers = await fleet.all();
    const server = values.server && fleet.server(values.server) ? values.server : servers[0]?.name;
    const images = server ? await fleet.images(server) : { backend: [], frontend: [] };
    // Default versions: the ones most clubs of that server run, or the newest.
    const common = (key: string, list: string[]) => {
      const counts = new Map<string, number>();
      for (const c of servers.find((s) => s.name === server)?.clubs ?? []) counts.set(c.facts[key], (counts.get(c.facts[key]) ?? 0) + 1);
      const best = [...counts.entries()].filter(([ver]) => list.includes(ver)).sort((a, b) => b[1] - a[1])[0]?.[0];
      return best ?? list[0];
    };
    return pages.newClubPage({
      csrf: session.csrf,
      servers,
      images,
      values: { ...values, server, backend: values.backend || common('env_backend', images.backend), frontend: values.frontend || common('env_frontend', images.frontend) },
      subscriptions: listSubscriptions(db).filter((s) => !s.slug),
      error,
    });
  };

  app.get('/clubs/new', async (request, reply) => {
    const session = await guard(request, reply);
    if (!session) return reply;
    const q = request.query as Record<string, string>;
    const values: pages.NewClubValues = {};
    if (q.subscription) {
      const sub = subscriptionOf(db, q.subscription);
      if (sub) {
        const settings = clubSettingsOf(sub);
        values.subscription = sub.id;
        values.plan = settings.plan ?? undefined;
        values.maxAircraft = settings.maxAircraft ? String(settings.maxAircraft) : undefined;
        values.slug = (sub.club_name ?? '')
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 31);
      }
    }
    return render(reply, session, 'Nouveau club', await newClubForm(session, values), '/clubs/new');
  });

  app.get('/updates', async (request, reply) => {
    const session = await guard(request, reply);
    if (!session) return reply;
    const servers = await fleet.all();
    const images = await mergedImages();
    return render(reply, session, 'Mises à jour', pages.updatesPage({ csrf: session.csrf, clubs: servers.flatMap((s) => s.clubs), images }), '/updates');
  });

  // Versions present on every server (an update to several servers needs them everywhere).
  const mergedImages = async () => {
    const lists = await Promise.all(fleet.servers.map((s) => fleet.images(s.name)));
    const both = (key: 'backend' | 'frontend') => lists.reduce<string[] | null>((acc, l) => (acc === null ? l[key] : acc.filter((x) => l[key].includes(x))), null) ?? [];
    return { backend: both('backend'), frontend: both('frontend') };
  };

  app.get('/jobs', async (request, reply) => {
    const session = await guard(request, reply);
    if (!session) return reply;
    return render(reply, session, 'Opérations', pages.jobsPage(jobs.list(100)), '/jobs', flashOf(request));
  });

  const jobId = (request: FastifyRequest): number | null => {
    const raw = (request.params as { id: string }).id;
    return /^[0-9]{1,9}$/.test(raw) ? Number(raw) : null;
  };

  const showJob = (reply: FastifyReply, session: Session, id: number, password: string | null = null, flash: { kind: 'ok' | 'error' | 'warn'; text: string } | null = null) => {
    const job = jobs.get(id);
    if (!job) return render(reply, session, 'Introuvable', pages.errorPage(404, 'Cette opération n’existe pas.'), '', null, 404);
    return render(
      reply,
      session,
      `Opération ${id}`,
      pages.jobPage({ csrf: session.csrf, job, lines: jobs.logAfter(id, 0, 5000), children: jobs.children(id), hasPassword: jobs.hasPassword(id), password, elevated: isElevated(session, now()) }),
      '/jobs',
      flash,
    );
  };

  app.get('/jobs/:id', async (request, reply) => {
    const session = await guard(request, reply);
    if (!session) return reply;
    const id = jobId(request);
    return id === null ? reply.code(404).send() : showJob(reply, session, id, null, flashOf(request));
  });

  app.get('/jobs/:id/log.json', async (request, reply) => {
    const session = await guard(request, reply);
    if (!session) return reply;
    const id = jobId(request);
    const job = id === null ? undefined : jobs.get(id);
    if (!job || id === null) return reply.code(404).send({ error: 'not found' });
    const after = Number((request.query as Record<string, string>).after ?? '0') || 0;
    return reply.type('application/json').send({
      lines: jobs.logAfter(id, after),
      status: job.status,
      statusLabel: STATUS_LABELS[job.status],
      finished: !['queued', 'running'].includes(job.status),
    });
  });

  app.post('/jobs/:id/cancel', async (request, reply) => {
    const session = await guard(request, reply);
    if (!session) return reply;
    const id = jobId(request);
    if (id === null) return reply.code(404).send();
    const result = jobs.cancel(id);
    recordAudit(db, { actor: ownerName(db) ?? 'owner', ip: request.ip, action: 'job.cancel', target: String(id), details: { result }, outcome: result === 'not-cancellable' ? 'refused' : 'ok' });
    return showJob(reply, session, id, null, {
      kind: result === 'not-cancellable' ? 'warn' : 'ok',
      text: result === 'cancelled' ? 'Opération annulée.' : result === 'stopping' ? 'Arrêt demandé : la mise à jour s’arrête après le club en cours.' : 'Cette opération ne peut plus être annulée sans risque : elle va jusqu’au bout.',
    });
  });

  app.post('/jobs/:id/password', async (request, reply) => {
    const session = await guard(request, reply);
    if (!session) return reply;
    const id = jobId(request);
    if (id === null) return reply.code(404).send();
    const body = (request.body ?? {}) as Body;
    if (!isElevated(session, now())) {
      const result = elevate(db, session, first(body.code).slice(0, 30), request.ip, policy, now());
      if (!result.ok) return showJob(reply, session, id, null, { kind: 'error', text: result.refusal ? refusalText(result.refusal) : 'Code incorrect.' });
    }
    const password = jobs.takePassword(id);
    recordAudit(db, { actor: ownerName(db) ?? 'owner', ip: request.ip, action: 'club.admin-password.shown', target: String(id), outcome: password ? 'ok' : 'refused' });
    return showJob(reply, session, id, password, password ? null : { kind: 'warn', text: 'Ce mot de passe a déjà été affiché, ou le délai de 30 minutes est passé.' });
  });

  app.get('/stripe', async (request, reply) => {
    const session = await guard(request, reply);
    if (!session) return reply;
    const servers = await fleet.all();
    return render(
      reply,
      session,
      'Abonnements',
      pages.stripePage({
        csrf: session.csrf,
        configured: config.stripeWebhookSecret !== null,
        webhookUrl: `${config.publicUrl}/stripe/webhook`,
        graceDays: config.graceDays,
        subscriptions: listSubscriptions(db),
        clubs: servers.flatMap((s) => s.clubs),
        events: recentEvents(db),
      }),
      '/stripe',
      flashOf(request),
    );
  });

  app.get('/audit', async (request, reply) => {
    const session = await guard(request, reply);
    if (!session) return reply;
    const before = Number((request.query as Record<string, string>).before ?? '') || undefined;
    const entries = listAudit(db, 200, before);
    const chain = verifyAuditChain(db);
    return render(reply, session, 'Journal', pages.auditPage({ entries, chainOk: chain.ok, brokenAt: chain.brokenAt, next: entries.length === 200 ? entries[199].id : null }), '/audit');
  });

  app.get('/account', async (request, reply) => {
    const session = await guard(request, reply);
    if (!session) return reply;
    return render(reply, session, 'Compte', pages.accountPage({ csrf: session.csrf, owner: ownerName(db) ?? '', recoveryLeft: recoveryCodesLeft(db) }), '/account');
  });

  app.post('/account/password', async (request, reply) => {
    const session = await guard(request, reply);
    if (!session) return reply;
    const body = (request.body ?? {}) as Body;
    const fail = (message: string) =>
      render(reply, session, 'Compte', pages.accountPage({ csrf: session.csrf, owner: ownerName(db) ?? '', recoveryLeft: recoveryCodesLeft(db), error: message }), '/account', null, 400);
    const stored = db.prepare('SELECT password_hash FROM owner WHERE id = 1').get() as { password_hash: string };
    if (!(await verifyPassword(first(body.current), stored.password_hash))) return fail('Mot de passe actuel incorrect.');
    if (first(body.next) !== first(body.again)) return fail('Les deux nouveaux mots de passe diffèrent.');
    const step = elevate(db, session, first(body.code).slice(0, 30), request.ip, policy, now());
    if (!step.ok) return fail(step.refusal ? refusalText(step.refusal) : 'Code incorrect.');
    try {
      await setPassword(db, first(body.next), now());
    } catch (error) {
      return fail((error as Error).message);
    }
    recordAudit(db, { actor: ownerName(db) ?? 'owner', ip: request.ip, action: 'account.password.changed' });
    setCookie(reply, cookieName, '', 0);
    return reply.redirect('/login', 303);
  });

  // --- Actions: a review page, then the confirmed run -----------------------------------
  interface Prepared {
    title: string;
    lines: (Html | string)[];
    warnings: string[];
    hidden: Record<string, string>;
    needsCode: boolean;
    danger: boolean;
    back: string;
    run: (actor: string) => { redirect: string; audit: Record<string, unknown>; target: string };
  }

  const clubTarget = async (body: Body): Promise<{ server: string; slug: string; club: NonNullable<Awaited<ReturnType<Fleet['club']>>> }> => {
    const server = v.serverName(first(body.server));
    if (!fleet.server(server)) throw new v.ValidationError('server', 'Serveur inconnu.');
    const slug = v.clubSlug(first(body.slug));
    const club = await fleet.club(server, slug);
    if (!club) throw new v.ValidationError('slug', `Aucun club « ${slug} » sur ${server}.`);
    return { server, slug, club };
  };

  const queue = (input: Parameters<Jobs['enqueue']>[0]) => {
    const id = jobs.enqueue(input);
    return { redirect: `/jobs/${id}?m=queued`, id };
  };

  const prepare = async (action: string, body: Body): Promise<Prepared> => {
    switch (action) {
      case 'backup': {
        const { server, slug } = await clubTarget(body);
        return {
          title: `Sauvegarder ${slug}`,
          lines: [`Club : ${slug} (serveur ${server})`, 'Sauvegarde de la base, des fichiers et des réglages, maintenant.'],
          warnings: [],
          hidden: { server, slug },
          needsCode: false,
          danger: false,
          back: `/clubs/${server}/${slug}`,
          run: (actor) => {
            const q = queue({ kind: 'backup', server, slug, params: {}, actor });
            return { redirect: q.redirect, audit: { job: q.id }, target: `${server}:${slug}` };
          },
        };
      }
      case 'set-plan': {
        const { server, slug, club } = await clubTarget(body);
        const plan = v.plan(first(body.plan));
        const maxAircraft = v.cap(first(body.maxAircraft), 'maxAircraft');
        const maxMembers = v.cap(first(body.maxMembers), 'maxMembers');
        const f = club.facts;
        const warnings: string[] = [];
        if (maxAircraft !== null && f.aircraft && Number(f.aircraft) > maxAircraft) warnings.push(`Le club a déjà ${f.aircraft} avions en service : il ne pourra plus en ajouter (rien n’est retiré).`);
        if (maxMembers !== null && f.members && Number(f.members) > maxMembers) warnings.push(`Le club a déjà ${f.members} membres actifs : il ne pourra plus en activer (rien n’est retiré).`);
        if (plan === 'club' && f.plan !== 'club') warnings.push('Passer à « Club » retire l’instruction : ce qui existe reste consultable, les ajouts sont refusés.');
        return {
          title: `Formule de ${slug}`,
          lines: [
            `Club : ${slug} (serveur ${server})`,
            `Formule : ${f.plan || 'complète'} → ${plan === 'club' ? 'Club' : 'Club + École'}`,
            `Avions en service : ${f.max_aircraft || 'sans limite'} → ${maxAircraft ?? 'sans limite'}`,
            `Membres actifs : ${f.max_members || 'sans limite'} → ${maxMembers ?? 'sans limite'}`,
            'L’API du club redémarre : environ 30 secondes de coupure pour ce club seulement. Si elle ne répond plus, l’ancienne formule est remise toute seule.',
          ],
          warnings,
          hidden: { server, slug, plan, maxAircraft: maxAircraft === null ? '' : String(maxAircraft), maxMembers: maxMembers === null ? '' : String(maxMembers) },
          needsCode: true,
          danger: false,
          back: `/clubs/${server}/${slug}`,
          run: (actor) => {
            const q = queue({ kind: 'set-plan', server, slug, params: { plan, maxAircraft, maxMembers }, actor });
            return { redirect: q.redirect, audit: { job: q.id, plan, maxAircraft, maxMembers }, target: `${server}:${slug}` };
          },
        };
      }
      case 'suspend':
      case 'resume': {
        const { server, slug } = await clubTarget(body);
        const sub = subscriptionForClub(db, server, slug);
        const warnings: string[] = [];
        if (action === 'resume' && sub && sub.unpaid_since) warnings.push('Son abonnement Stripe est toujours impayé : la règle des impayés le suspendra de nouveau dans 6 heures au plus. Détachez l’abonnement pour l’en empêcher.');
        return {
          title: action === 'suspend' ? `Suspendre ${slug}` : `Réactiver ${slug}`,
          lines:
            action === 'suspend'
              ? [`Club : ${slug} (serveur ${server})`, 'Ses membres verront « Service suspendu, contactez l’administrateur de votre club ou le prestataire SkyCrew ».', 'Plus aucune modification possible ; rien n’est effacé.', 'Environ 30 secondes de redémarrage de son API.']
              : [`Club : ${slug} (serveur ${server})`, 'Ses membres retrouvent leur espace tel quel.', 'Environ 30 secondes de redémarrage de son API.'],
          warnings,
          hidden: { server, slug },
          needsCode: true,
          danger: action === 'suspend',
          back: `/clubs/${server}/${slug}`,
          run: (actor) => {
            const q = queue({ kind: action, server, slug, params: { reason: 'owner' }, actor });
            return { redirect: q.redirect, audit: { job: q.id }, target: `${server}:${slug}` };
          },
        };
      }
      case 'enable-site': {
        const { server, slug, club } = await clubTarget(body);
        if (slug === 'skycrew') throw new v.ValidationError('slug', 'Le site du premier club a été activé à la main.');
        return {
          title: `Activer le site de ${slug}`,
          lines: [`Adresse : ${club.facts.url}`, 'Le site du club est ajouté à nginx, la configuration vérifiée (nginx -t) avant tout rechargement, puis certbot obtient le certificat HTTPS.', 'Les autres sites du serveur ne sont pas coupés (rechargement, jamais redémarrage).'],
          warnings: club.facts.domain_ready === '200' ? ['Le site semble déjà répondre à cette adresse.'] : [],
          hidden: { server, slug },
          needsCode: true,
          danger: false,
          back: `/clubs/${server}/${slug}`,
          run: (actor) => {
            const q = queue({ kind: 'enable-site', server, slug, params: {}, actor });
            return { redirect: q.redirect, audit: { job: q.id }, target: `${server}:${slug}` };
          },
        };
      }
      case 'update': {
        const { server, slug, club } = await clubTarget(body);
        const backend = v.optionalVersion(first(body.backend), 'backend');
        const frontend = v.optionalVersion(first(body.frontend), 'frontend');
        if (!backend && !frontend) throw new v.ValidationError('version', 'Choisissez au moins une version.');
        const f = club.facts;
        return {
          title: `Mettre à jour ${slug}`,
          lines: [
            `Club : ${slug} (serveur ${server})`,
            backend ? `API : ${f.env_backend} → ${backend}` : 'API : inchangée',
            frontend ? `Application : ${f.env_frontend} → ${frontend}` : 'Application : inchangée',
            'Sauvegarde, bascule, attente qu’il réponde ; retour tout seul aux versions actuelles sinon.',
          ],
          warnings: f.backup_installed !== 'yes' ? ['Ce club n’a pas de sauvegarde installée : la mise à jour sera refusée.'] : [],
          hidden: { server, slug, backend: backend ?? '', frontend: frontend ?? '' },
          needsCode: true,
          danger: false,
          back: `/clubs/${server}/${slug}`,
          run: (actor) => {
            const q = queue({ kind: 'update', server, slug, params: { backend, frontend }, actor });
            return { redirect: q.redirect, audit: { job: q.id, backend, frontend }, target: `${server}:${slug}` };
          },
        };
      }
      case 'update-all': {
        const backend = v.optionalVersion(first(body.backend), 'backend');
        const frontend = v.optionalVersion(first(body.frontend), 'frontend');
        if (!backend && !frontend) throw new v.ValidationError('version', 'Choisissez au moins une version.');
        const wanted = all(body.targets);
        if (wanted.length === 0) throw new v.ValidationError('targets', 'Choisissez au moins un club.');
        const targets: UpdateTarget[] = [];
        const lines: (Html | string)[] = [];
        for (const t of wanted.slice(0, 200)) {
          const [server, slug] = t.split(':');
          const { club } = await clubTarget({ server, slug });
          const f = club.facts;
          const current = (!backend || f.env_backend === backend) && (!frontend || f.env_frontend === frontend);
          targets.push({ server: club.server, slug: club.slug });
          lines.push(
            current
              ? `${club.slug} (${club.server}) : déjà dans ces versions, rien à faire`
              : `${club.slug} (${club.server}) : ${backend ? `API ${f.env_backend} → ${backend}` : ''}${backend && frontend ? ', ' : ''}${frontend ? `application ${f.env_frontend} → ${frontend}` : ''}${f.backup_installed !== 'yes' ? ' — AUCUNE SAUVEGARDE : sera refusé' : ''}`,
          );
        }
        const continueOnError = first(body.continueOnError) === '1';
        lines.push(continueOnError ? 'Un club en échec n’arrête pas les suivants.' : 'Arrêt au premier club en échec (il revient tout seul à ses versions).');
        return {
          title: 'Mettre à jour plusieurs clubs',
          lines,
          warnings: [],
          hidden: { backend: backend ?? '', frontend: frontend ?? '', targets: targets.map((t) => `${t.server}:${t.slug}`).join(','), continueOnError: continueOnError ? '1' : '' },
          needsCode: true,
          danger: false,
          back: '/updates',
          run: (actor) => {
            const q = queue({ kind: 'update-all', server: targets[0].server, slug: null, params: { backend, frontend, targets, continueOnError }, actor });
            return { redirect: q.redirect, audit: { job: q.id, backend, frontend, clubs: targets.length }, target: 'plusieurs clubs' };
          },
        };
      }
      case 'create': {
        const server = v.serverName(first(body.server));
        if (!fleet.server(server)) throw new v.ValidationError('server', 'Serveur inconnu.');
        const slug = v.clubSlug(first(body.slug), { allowFirst: false });
        const domain = v.domain(first(body.domain));
        const adminEmail = v.email(first(body.adminEmail), 'adminEmail');
        const plan = v.plan(first(body.plan));
        const maxAircraft = v.cap(first(body.maxAircraft), 'maxAircraft');
        const maxMembers = v.cap(first(body.maxMembers), 'maxMembers');
        const backend = v.version(first(body.backend), 'backend');
        const frontend = v.version(first(body.frontend), 'frontend');
        const alertWebhook = v.alertWebhook(first(body.alertWebhook));
        const subscription = first(body.subscription) ? v.stripeSubscriptionId(first(body.subscription)) : null;
        if (subscription && !subscriptionOf(db, subscription)) throw new v.ValidationError('subscription', 'Abonnement inconnu.');
        const status = await fleet.status(server);
        if (status.clubs.some((c) => c.slug === slug)) throw new v.ValidationError('slug', `Le club « ${slug} » existe déjà sur ${server}.`);
        if (status.clubs.some((c) => c.facts.url === `https://${domain}`)) throw new v.ValidationError('domain', `L’adresse ${domain} est déjà celle d’un autre club.`);
        const warnings: string[] = [];
        if (status.reachable && status.fit === 0) warnings.push('D’après le relevé, ce serveur n’a plus de place pour un club de plus.');
        return {
          title: `Créer le club ${slug}`,
          lines: [
            `Serveur : ${server} (dossier /opt/skycrew-${slug})`,
            `Adresse : https://${domain}`,
            html`Premier administrateur : ${adminEmail} (mot de passe provisoire affiché une seule fois à la fin)`,
            `Formule : ${plan === 'club' ? 'Club' : 'Club + École'} ; avions : ${maxAircraft ?? 'sans limite'} ; membres : ${maxMembers ?? 'sans limite'}`,
            `Versions : API ${backend}, application ${frontend}`,
            `Alerte de panne : ${alertWebhook ? 'webhook renseigné' : 'aucune (à ajouter plus tard)'}`,
            subscription ? `Abonnement relié : ${subscription}` : 'Aucun abonnement relié',
            'Le site nginx est préparé mais pas activé : « Activer le site » ensuite, quand l’adresse pointe vers le serveur.',
          ],
          warnings,
          hidden: {
            server,
            slug,
            domain,
            adminEmail,
            plan,
            maxAircraft: maxAircraft === null ? '' : String(maxAircraft),
            maxMembers: maxMembers === null ? '' : String(maxMembers),
            backend,
            frontend,
            alertWebhook: alertWebhook ?? '',
            subscription: subscription ?? '',
          },
          needsCode: true,
          danger: false,
          back: '/clubs/new',
          run: (actor) => {
            const q = queue({
              kind: 'create',
              server,
              slug,
              params: { domain, adminEmail, plan, maxAircraft, maxMembers, backend, frontend, hasWebhook: alertWebhook !== null },
              actor,
              alertWebhook,
            });
            if (subscription) linkSubscription(db, subscription, server, slug, now());
            return { redirect: q.redirect, audit: { job: q.id, domain, plan, maxAircraft, maxMembers, backend, frontend, subscription }, target: `${server}:${slug}` };
          },
        };
      }
      case 'link-subscription': {
        const subscription = v.stripeSubscriptionId(first(body.subscription));
        const sub = subscriptionOf(db, subscription);
        if (!sub) throw new v.ValidationError('subscription', 'Abonnement inconnu.');
        const clubValue = first(body.club);
        let server: string | null = null;
        let slug: string | null = null;
        if (clubValue) {
          const [s, c] = clubValue.split(':');
          const target = await clubTarget({ server: s, slug: c });
          server = target.server;
          slug = target.slug;
        }
        const other = server && slug ? subscriptionForClub(db, server, slug) : undefined;
        return {
          title: 'Relier un abonnement',
          lines: [
            `Abonnement : ${sub.club_name || sub.id} (${sub.id})`,
            slug ? `Club : ${slug} (serveur ${server})` : 'Club : aucun (l’abonnement est détaché)',
            slug ? 'La règle des impayés s’appliquera à ce club.' : 'La règle des impayés ne s’appliquera plus à aucun club pour cet abonnement.',
          ],
          warnings: other && other.id !== sub.id ? [`Ce club était relié à l’abonnement ${other.id}, qui sera détaché.`] : [],
          hidden: { subscription, club: clubValue },
          needsCode: true,
          danger: false,
          back: '/stripe',
          run: () => {
            linkSubscription(db, subscription, server, slug, now());
            return { redirect: '/stripe?m=linked', audit: { subscription, server, slug }, target: subscription };
          },
        };
      }
      default:
        throw new v.ValidationError('action', 'Action inconnue.');
    }
  };

  // When a review fails its checks, the form it came from is shown again.
  const formAgain = async (action: string, session: Session, body: Body, message: string): Promise<Html | null> => {
    if (action === 'create') {
      const values: pages.NewClubValues = {};
      for (const key of ['server', 'slug', 'domain', 'adminEmail', 'plan', 'maxAircraft', 'maxMembers', 'backend', 'frontend', 'subscription'] as const) values[key] = first(body[key]).slice(0, 300);
      return newClubForm(session, values, message);
    }
    if (action === 'update-all') {
      const servers = await fleet.all();
      return pages.updatesPage({ csrf: session.csrf, clubs: servers.flatMap((s) => s.clubs), images: await mergedImages(), error: message });
    }
    return null;
  };

  app.post('/act/:action', async (request, reply) => {
    const session = await guard(request, reply);
    if (!session) return reply;
    const action = (request.params as { action: string }).action;
    const body = { ...((request.body ?? {}) as Body) };
    // update-all carries its clubs as one field on the confirmation page.
    if (action === 'update-all' && first(body.step) === 'run') body.targets = first(body.targets).split(',').filter(Boolean);
    const actor = ownerName(db) ?? 'owner';
    let prepared: Prepared;
    try {
      prepared = await prepare(action, body);
    } catch (error) {
      if (!(error instanceof v.ValidationError)) throw error;
      recordAudit(db, { actor, ip: request.ip, action: `${action}.refused`, details: { field: error.field, message: error.message }, outcome: 'refused' });
      const again = first(body.step) === 'review' ? await formAgain(action, session, body, error.message) : null;
      if (again) return render(reply, session, 'Vérification', again, '', null, 400);
      return render(reply, session, 'Refusé', pages.errorPage(400, error.message), '', null, 400);
    }
    const review = (error: string | null = null, status = 200) =>
      render(
        reply,
        session,
        prepared.title,
        pages.reviewPage({ csrf: session.csrf, action, title: prepared.title, lines: prepared.lines, warnings: prepared.warnings, hidden: prepared.hidden, elevated: isElevated(session, now()), needsCode: prepared.needsCode, danger: prepared.danger, back: prepared.back, error }),
        '',
        null,
        status,
      );
    if (first(body.step) !== 'run') return review();
    if (prepared.needsCode && !isElevated(session, now())) {
      const result = elevate(db, session, first(body.code).slice(0, 30), request.ip, policy, now());
      if (!result.ok) {
        recordAudit(db, { actor, ip: request.ip, action: `${action}.code`, outcome: 'refused' });
        return review(result.refusal ? refusalText(result.refusal) : 'Code incorrect, ou déjà utilisé : attendez le suivant.', 401);
      }
    }
    const done = prepared.run(actor);
    recordAudit(db, { actor, ip: request.ip, action, target: done.target, details: done.audit });
    jobs.tick();
    return reply.redirect(done.redirect, 303);
  });

  app.setNotFoundHandler(async (request, reply) => {
    const session = sessionOf(request);
    return render(reply, session?.stage === 'full' ? session : null, 'Introuvable', pages.errorPage(404, 'Cette page n’existe pas.'), '', null, 404);
  });

  app.setErrorHandler(async (error, request, reply) => {
    process.stderr.write(`error ${request.method} ${request.url}: ${(error as Error).stack ?? error}\n`);
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return send(reply, status >= 400 && status < 600 ? status : 500, page({ title: 'Erreur', body: pages.errorPage(status, status === 500 ? 'Erreur de la console : rien n’a été lancé. Le détail est dans le journal du serveur.' : 'Requête refusée.') }));
  });

  return app;
};
