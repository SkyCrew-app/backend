// End-to-end run of the console against throwaway club installations on this
// machine: a fake server tree (SERVER_ROOT), the real helper and deployment
// kit, real Docker containers from local images, a fake ssh for the second
// server, and a real browser. Everything is removed at the end.
//
//   E2E_REGISTRY=skycrew-e2e E2E_VERSION=2.99.0 node test/e2e/run.ts
//
// Needs the images $E2E_REGISTRY/backend:$E2E_VERSION and frontend:$E2E_VERSION
// (built from the branches holding SKYCREW_SUSPENDED support). Builds a broken
// backend 2.99.9 to show the automatic return to the previous version.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import Stripe from 'stripe';
import { totpAt, stepAt } from '../../src/security/totp.ts';
import { CONSOLE_DIR, makeKit, writeConf } from '../support.ts';

const REGISTRY = process.env.E2E_REGISTRY ?? 'skycrew-e2e';
const VERSION = process.env.E2E_VERSION ?? '2.99.0';
const BROKEN = '2.99.9';
const PORT = Number(process.env.E2E_PORT ?? 8095);
const BASE = `http://localhost:${PORT}`;
const DIR = process.env.E2E_DIR ?? join(CONSOLE_DIR, 'test-results', 'e2e');
const SHOTS = process.env.E2E_SHOTS ?? join(DIR, 'screenshots');
const SLUG = 'e2etest-vexin';
const DOMAIN = 'e2etest-vexin.skycrew.test';
const WEBHOOK_SECRET = 'whsec_e2econsoletestsecret';
const HELPER = join(CONSOLE_DIR, 'helper', 'skycrew-console-helper');
const PASSWORD = 'phrase de passe de test e2e';

const log = (...args: unknown[]) => console.log(`[e2e ${new Date().toISOString().slice(11, 19)}]`, ...args);
const sh = (cmd: string, args: string[], opts: { input?: string; cwd?: string; env?: NodeJS.ProcessEnv } = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { code: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};

const results: { step: string; ok: boolean; note?: string }[] = [];
const axeReport: { page: string; serious: number; critical: number; ids: string[] }[] = [];
const check = (step: string, ok: boolean, note?: string) => {
  results.push({ step, ok, note });
  log(ok ? 'OK ' : 'KO ', step, note ?? '');
  if (!ok && process.env.E2E_STOP_ON_FAIL) throw new Error(`échec : ${step} ${note ?? ''}`);
};

// --- Layout --------------------------------------------------------------------------
rmSync(DIR, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });
const kit = makeKit(DIR);
const bin = join(DIR, 'bin');
mkdirSync(bin);
const rootA = join(DIR, 'server-a');
const rootB = join(DIR, 'server-b');
for (const r of [rootA, rootB]) mkdirSync(join(r, 'opt'), { recursive: true });
const fake = (name: string, body: string) => {
  writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`);
  chmodSync(join(bin, name), 0o755);
};
// nginx, systemctl and certbot of the fake server: they record what they were asked.
fake('nginx', `echo "nginx $*" >> "${DIR}/nginx-calls"; echo "nginx: configuration file test is successful"`);
fake('systemctl', `echo "systemctl $*" >> "${DIR}/nginx-calls"`);
fake('certbot', `echo "certbot $*" >> "${DIR}/nginx-calls"; echo "Successfully deployed certificate"`);
// ssh to the second server: the options and host are dropped, the command runs
// here with that server's own settings (another tree).
fake(
  'ssh',
  `while [ $# -gt 0 ]; do case $1 in -o) shift 2 ;; --) shift; break ;; *) host=$1; shift ;; esac; done
[ "$host" = e2e-b ] || { echo "ssh: unknown host $host" >&2; exit 255; }
SKYCREW_HELPER_CONF="${DIR}/helper-b.conf" exec sh -c "$*"`,
);
const conf = (root: string) => ({
  KIT_DIR: kit,
  SERVER_ROOT: root,
  REGISTRY,
  IMAGE_SOURCE: 'preloaded',
  HEALTH_WAIT: '90',
  LOCK_DIR: join(root, 'run-lock'),
  NGINX_BIN: join(bin, 'nginx'),
  SYSTEMCTL_BIN: join(bin, 'systemctl'),
  CERTBOT_BIN: join(bin, 'certbot'),
});
writeConf(join(DIR, 'helper-a.conf'), conf(rootA));
writeConf(join(DIR, 'helper-b.conf'), conf(rootB));

const env: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  CONSOLE_PUBLIC_URL: BASE,
  CONSOLE_PORT: String(PORT),
  CONSOLE_DB: join(DIR, 'data', 'console.db'),
  CONSOLE_SERVERS: 'aero1=local,aero2=ssh:e2e-b',
  CONSOLE_HELPER: `sh ${HELPER}`,
  CONSOLE_SSH: join(bin, 'ssh'),
  CONSOLE_REMOTE_HELPER: `sh ${HELPER}`,
  SKYCREW_HELPER_CONF: join(DIR, 'helper-a.conf'),
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STRIPE_GRACE_DAYS: '14',
  CONSOLE_STATUS_TTL_SECONDS: '5',
};
const cli = join(CONSOLE_DIR, 'bin', 'skycrew-console.ts');

let server: ChildProcess | null = null;
let browser: Browser | null = null;
let totpSecret = '';
let lastStep = 0;

/** A phone code never used before (waits for the next 30-second step when needed). */
const freshCode = async (): Promise<string> => {
  while (stepAt(Date.now()) <= lastStep) await new Promise((r) => setTimeout(r, 1000));
  lastStep = stepAt(Date.now());
  return totpAt(totpSecret, Date.now());
};

const createOwner = async () => {
  const child = spawn('node', ['--disable-warning=ExperimentalWarning', cli, 'create-owner'], { env });
  const closed = new Promise((r) => child.on('close', r));
  let output = '';
  const waitFor = (pattern: RegExp) =>
    new Promise<RegExpExecArray>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`create-owner : pas de ${pattern} dans ${output}`)), 30_000);
      const look = () => {
        const m = pattern.exec(output);
        if (m) {
          clearTimeout(timer);
          resolve(m);
        } else setTimeout(look, 100);
      };
      look();
    });
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  await waitFor(/Identifiant/);
  child.stdin.write('owner\n');
  await waitFor(/Mot de passe \(12/);
  child.stdin.write(`${PASSWORD}\n`);
  await waitFor(/Le même, encore/);
  child.stdin.write(`${PASSWORD}\n`);
  const key = await waitFor(/en tapant cette clé : ([A-Z2-7 ]+)\n/);
  totpSecret = key[1].replace(/ /g, '');
  child.stdin.write(`${await freshCode()}\n`);
  await waitFor(/Ils ne seront plus jamais affichés/);
  child.stdin.end();
  await closed;
  writeFileSync(join(DIR, 'cli-create-owner.txt'), output.replace(/[a-z2-7]{5}-[a-z2-7]{5}/g, '#####-#####'));
  check('create-owner (ligne de commande, QR + code du téléphone, codes de secours)', /Compte « owner » créé/.test(output) && (output.match(/[a-z2-7]{5}-[a-z2-7]{5}/g) ?? []).length === 10);
};

const startConsole = async () => {
  try {
    await fetch(`${BASE}/healthz`);
    throw new Error(`le port ${PORT} est déjà pris : arrêtez ce qui l’écoute`);
  } catch (error) {
    if ((error as Error).message.startsWith('le port')) throw error;
  }
  server = spawn('node', ['--disable-warning=ExperimentalWarning', cli, 'serve'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const out: string[] = [];
  server.stdout!.on('data', (d) => out.push(String(d)));
  server.stderr!.on('data', (d) => out.push(String(d)));
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${BASE}/healthz`)).ok) return out;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`la console ne démarre pas :\n${out.join('')}`);
};

// --- Accessibility (axe-core) ----------------------------------------------------------
const axeSource = readFileSync(join(CONSOLE_DIR, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
const axe = async (page: Page, name: string) => {
  await page.addScriptTag({ content: axeSource });
  const violations = (await page.evaluate(async () => {
    // @ts-expect-error axe is injected above
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v: { id: string; impact: string }) => ({ id: v.id, impact: v.impact }));
  })) as { id: string; impact: string }[];
  const serious = violations.filter((v) => v.impact === 'serious').length;
  const critical = violations.filter((v) => v.impact === 'critical').length;
  axeReport.push({ page: name, serious, critical, ids: violations.map((v) => `${v.id}(${v.impact})`) });
  check(`axe ${name} : 0 grave / critique`, serious + critical === 0, violations.map((v) => `${v.id}:${v.impact}`).join(' '));
};

const shot = async (page: Page, name: string) => {
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
};

const waitJob = async (page: Page, id: number, timeoutMs = 12 * 60_000): Promise<string> => {
  const start = Date.now();
  for (;;) {
    const r = await page.request.get(`${BASE}/jobs/${id}/log.json?after=0`);
    const data = (await r.json()) as { status: string; finished: boolean };
    if (data.finished) return data.status;
    if (Date.now() - start > timeoutMs) return 'timeout';
    await new Promise((res) => setTimeout(res, 2000));
  }
};

const visible = async (page: Page, text: string): Promise<boolean> =>
  page
    .getByText(text)
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

const jobIdOf = (page: Page): number => Number(/\/jobs\/(\d+)/.exec(page.url())?.[1] ?? NaN);

/** Submits the confirmation page, giving a phone code when it is asked. */
const confirm = async (page: Page) => {
  const code = page.locator('input[name="code"]');
  if (await code.count()) await code.fill(await freshCode());
  await Promise.all([page.waitForURL(/\/jobs\/\d+|\/stripe/), page.getByRole('button', { name: 'Confirmer' }).click()]);
};

const clubPort = (): string => {
  const envFile = readFileSync(join(rootA, 'opt', `skycrew-${SLUG}`, '.env'), 'utf8');
  return /^LOCAL_PORT=(\d+)/m.exec(envFile)?.[1] ?? '';
};

const stripeEvent = async (type: string, object: Record<string, unknown>, created: number) => {
  const payload = JSON.stringify({ id: `evt_e2e_${type}_${created}`, object: 'event', type, created: Math.floor(created / 1000), livemode: false, data: { object } });
  const signature = new Stripe('sk_test_unused').webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  const r = await fetch(`${BASE}/stripe/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, body: payload });
  return r.status;
};
const SUB = {
  id: 'sub_E2Econsole0001',
  object: 'subscription',
  customer: 'cus_e2e',
  livemode: false,
  cancel_at_period_end: false,
  metadata: { tier: 'club-ecole', cycle: 'monthly', aircraft: '4', club_name: 'Aéroclub du Vexin (test)', contact_name: 'Jeanne Test', contact_email: 'jeanne@example.test', language: 'fr' },
  items: { data: [{ quantity: 1 }, { quantity: 4 }] },
};

// --- The run ---------------------------------------------------------------------------
const main = async () => {
  for (const image of [`${REGISTRY}/backend:${VERSION}`, `${REGISTRY}/frontend:${VERSION}`]) {
    if (sh('docker', ['image', 'inspect', image]).code !== 0) throw new Error(`image ${image} absente`);
  }
  log('image cassée', `${REGISTRY}/backend:${BROKEN}`);
  const built = sh('docker', ['build', '-q', '-t', `${REGISTRY}/backend:${BROKEN}`, '-'], {
    input: `FROM ${REGISTRY}/backend:${VERSION}\nCMD ["node", "-e", "console.error('version cassée exprès pour le test'); process.exit(1)"]\n`,
  });
  if (built.code !== 0) throw new Error(built.out);

  await createOwner();
  const serverLog = await startConsole();
  browser = await chromium.launch();
  const desktop: BrowserContext = await browser.newContext({ viewport: { width: 1366, height: 900 }, bypassCSP: true, locale: 'fr-FR' });
  const page = await desktop.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

  // Sign in.
  await page.goto(`${BASE}/`);
  check('sans session : renvoi vers la connexion', page.url().startsWith(`${BASE}/login`));
  await shot(page, '01-connexion');
  await axe(page, 'connexion');
  await page.getByLabel('Identifiant').fill('owner');
  await page.getByLabel('Mot de passe').fill('mauvais mot de passe');
  await page.getByRole('button', { name: 'Continuer' }).click();
  check('mauvais mot de passe refusé', await visible(page, 'Identifiant ou mot de passe incorrect'));
  await page.getByLabel('Identifiant').fill('owner');
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.waitForURL(/\/login\/code/);
  await shot(page, '02-code');
  await axe(page, 'code');
  await page.getByLabel('Code').fill('000000');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  check('code faux refusé', await visible(page, 'Code incorrect'));
  await page.getByLabel('Code').fill(await freshCode());
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(`${BASE}/`);
  check('connecté avec mot de passe + code TOTP', await page.getByRole('heading', { name: 'Clubs', exact: true }).isVisible());
  const cookies = await desktop.cookies();
  const session = cookies.find((c) => c.name === '__Host-skycrew_console');
  check('cookie de session HttpOnly, Secure, SameSite=Strict', !!session && session.httpOnly && session.secure && session.sameSite === 'Strict');
  await shot(page, '03-tableau-vide');

  // Create a club.
  await page.goto(`${BASE}/clubs/new`);
  await page.locator('#server').selectOption('aero1');
  await page.locator('#slug').fill(SLUG);
  await page.locator('#domain').fill(DOMAIN);
  await page.locator('#adminEmail').fill('president@example.test');
  await page.locator('input[name=plan][value=club]').check();
  await page.locator('#maxAircraft').fill('3');
  await page.locator('#backend').selectOption(VERSION);
  await page.locator('#frontend').selectOption(VERSION);
  await page.locator('#alertWebhook').fill('https://discord.com/api/webhooks/123/e2e-secret-token');
  await shot(page, '04-nouveau-club');
  await axe(page, 'nouveau club');
  await page.getByRole('button', { name: 'Vérifier…' }).click();
  await shot(page, '05-nouveau-club-confirmation');
  await axe(page, 'confirmation');
  check('la confirmation ne montre pas le webhook', !(await page.content()).includes('e2e-secret-token') || (await page.locator('text=e2e-secret-token').count()) === 0);
  await confirm(page);
  const createJob = jobIdOf(page);
  log('création, opération', createJob);
  await shot(page, '06-creation-en-cours');
  const createStatus = await waitJob(page, createJob);
  check('club créé par new-club.sh via l’outil', createStatus === 'succeeded', createStatus);
  await page.reload();
  const reveal = page.getByRole('button', { name: 'Afficher le mot de passe' });
  if (await reveal.count()) {
    const code = page.locator('input[name="code"]');
    if (await code.count()) await code.fill(await freshCode());
    await reveal.click();
  }
  check('mot de passe provisoire affiché une fois', await page.locator('.secret').isVisible());
  await shot(page, '07-creation-terminee-mot-de-passe');
  await page.reload();
  check('mot de passe plus jamais affiché', (await page.locator('.secret').count()) === 0);
  const logText = await page.locator('#job-log').innerText();
  check('journal sans e-mail ni webhook ni mot de passe', !/president@example\.test|e2e-secret-token/.test(logText));
  const envFile = readFileSync(join(rootA, 'opt', `skycrew-${SLUG}`, '.env'), 'utf8');
  check('.env du club : formule, limite, images e2e', /SKYCREW_PLAN=club/.test(envFile) && /SKYCREW_MAX_AIRCRAFT=3/.test(envFile) && new RegExp(`BACKEND_IMAGE=${REGISTRY}/backend`).test(envFile));
  check('webhook d’alerte passé au veilleur (entrée standard)', readFileSync(join(rootA, 'etc', `skycrew-watch-${SLUG}.env`), 'utf8').includes('e2e-secret-token'));

  // Dashboard with the club.
  await page.goto(`${BASE}/`);
  check('le club apparaît au tableau de bord', await page.getByRole('link', { name: SLUG, exact: true }).first().isVisible());
  await shot(page, '08-tableau-de-bord');
  await axe(page, 'tableau de bord');

  // Club page, enable the site.
  await page.goto(`${BASE}/clubs/aero1/${SLUG}`);
  await shot(page, '09-club');
  await axe(page, 'page du club');
  await page.getByRole('button', { name: 'Activer le site…' }).click();
  await confirm(page);
  const siteStatus = await waitJob(page, jobIdOf(page));
  const calls = existsSync(join(DIR, 'nginx-calls')) ? readFileSync(join(DIR, 'nginx-calls'), 'utf8') : '';
  check('site activé : nginx -t, reload (jamais restart), certbot', siteStatus === 'succeeded' && /nginx -t/.test(calls) && /systemctl reload nginx/.test(calls) && !/restart/.test(calls) && /certbot --nginx --non-interactive --redirect -d e2etest-vexin\.skycrew\.test/.test(calls), `${siteStatus} ${calls.replace(/\n/g, ' | ')}`);
  check('lien du site créé', existsSync(join(rootA, 'etc', 'nginx', 'sites-enabled', `skycrew-${SLUG}.conf`)));

  // Change the plan.
  await page.goto(`${BASE}/clubs/aero1/${SLUG}`);
  await page.locator('input[name=plan][value=ecole]').check();
  await page.locator('#maxAircraft').fill('5');
  await page.locator('#maxMembers').fill('80');
  await page.getByRole('button', { name: 'Changer…' }).click();
  await shot(page, '10-formule-confirmation');
  await confirm(page);
  const planStatus = await waitJob(page, jobIdOf(page));
  const envAfterPlan = readFileSync(join(rootA, 'opt', `skycrew-${SLUG}`, '.env'), 'utf8');
  check('formule changée (ecole, 5 avions, 80 membres) et club de nouveau en bonne santé', planStatus === 'succeeded' && /SKYCREW_PLAN=ecole/.test(envAfterPlan) && /SKYCREW_MAX_AIRCRAFT=5/.test(envAfterPlan) && /SKYCREW_MAX_MEMBERS=80/.test(envAfterPlan), planStatus);

  // Backup.
  await page.goto(`${BASE}/clubs/aero1/${SLUG}`);
  await page.getByRole('button', { name: 'Sauvegarder…' }).click();
  await Promise.all([page.waitForURL(/\/jobs\/\d+/), page.getByRole('button', { name: 'Confirmer' }).click()]);
  const backupStatus = await waitJob(page, jobIdOf(page));
  const backups = existsSync(join(rootA, 'var', 'backups', `skycrew-${SLUG}`)) ? readdirSync(join(rootA, 'var', 'backups', `skycrew-${SLUG}`)) : [];
  check('sauvegarde faite (base, fichiers, .env)', backupStatus === 'succeeded' && backups.some((f) => f.endsWith('.sql.gz')) && backups.some((f) => f.startsWith('uploads-')), backups.join(' '));
  await page.reload();
  await shot(page, '11-sauvegarde');

  // Suspend, see the club's app, resume.
  const port = clubPort();
  await page.goto(`${BASE}/clubs/aero1/${SLUG}`);
  await page.getByRole('button', { name: 'Suspendre…' }).click();
  await shot(page, '12-suspension-confirmation');
  await confirm(page);
  const suspendStatus = await waitJob(page, jobIdOf(page));
  check('club suspendu (l’API le confirme)', suspendStatus === 'succeeded', suspendStatus);
  const app = await desktop.newPage();
  await app.goto(`http://localhost:${port}/`);
  await app.waitForLoadState('networkidle');
  check('l’application du club montre « Service suspendu »', /\/system\/suspended/.test(app.url()) && (await visible(app, 'Service suspendu')), app.url());
  await app.screenshot({ path: join(SHOTS, '13-application-du-club-suspendue.png'), fullPage: true });
  const mutation = await fetch(`http://localhost:${port}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'mutation { requestPasswordReset(email: "personne@example.test") }' }) });
  const mutationText = await mutation.text();
  check('l’API du club refuse les modifications', /suspendu/.test(mutationText), mutationText.slice(0, 200));
  await page.goto(`${BASE}/`);
  await shot(page, '14-tableau-club-suspendu');
  await page.goto(`${BASE}/clubs/aero1/${SLUG}`);
  await page.getByRole('button', { name: 'Réactiver…' }).click();
  await confirm(page);
  const resumeStatus = await waitJob(page, jobIdOf(page));
  check('club réactivé', resumeStatus === 'succeeded', resumeStatus);
  await app.goto(`http://localhost:${port}/`);
  await app.waitForLoadState('networkidle');
  check('l’application du club est de nouveau ouverte', !/suspended/.test(app.url()), app.url());
  await app.screenshot({ path: join(SHOTS, '15-application-du-club-reactivee.png'), fullPage: true });
  await app.close();

  // Update to a broken version: automatic return.
  await page.goto(`${BASE}/clubs/aero1/${SLUG}`);
  await page.locator('#backend').selectOption(BROKEN);
  await page.getByRole('button', { name: 'Mettre à jour…' }).click();
  await shot(page, '16-mise-a-jour-confirmation');
  await confirm(page);
  const updateJob = jobIdOf(page);
  const updateStatus = await waitJob(page, updateJob);
  await page.reload();
  check('version cassée : retour automatique à la précédente', updateStatus === 'rolled_back', updateStatus);
  await shot(page, '17-mise-a-jour-retour-arriere');
  await axe(page, 'opération');
  const envAfterUpdate = readFileSync(join(rootA, 'opt', `skycrew-${SLUG}`, '.env'), 'utf8');
  check('le .env reprend l’ancienne version', new RegExp(`BACKEND_VERSION=${VERSION.replace(/\./g, '\\.')}`).test(envAfterUpdate));

  // Stripe: subscription, link, cancellation 15 days ago, then paid again.
  const now = Date.now();
  check('notification Stripe signée acceptée', (await stripeEvent('checkout.session.completed', { id: 'cs_e2e', object: 'checkout.session', subscription: SUB.id, metadata: SUB.metadata }, now - 40 * 86_400_000)) === 200);
  await stripeEvent('customer.subscription.created', { ...SUB, status: 'active' }, now - 40 * 86_400_000);
  const forged = await fetch(`${BASE}/stripe/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=00' }, body: '{}' });
  check('notification non signée refusée', forged.status === 400);
  await page.goto(`${BASE}/stripe`);
  await shot(page, '18-abonnements');
  await axe(page, 'abonnements');
  await page.locator('select[name=club]').first().selectOption(`aero1:${SLUG}`);
  await page.getByRole('button', { name: 'Relier…' }).click();
  await confirm(page);
  check('abonnement relié au club', await visible(page, 'Abonnement relié.'));
  await stripeEvent('customer.subscription.deleted', { ...SUB, status: 'canceled' }, now - 15 * 86_400_000);
  await page.goto(`${BASE}/jobs`);
  const autoSuspend = await page.locator('tr', { hasText: 'règle Stripe' }).first().locator('a').first().textContent();
  check('résiliation de plus de 14 jours : suspension automatique lancée', !!autoSuspend);
  const autoSuspendStatus = autoSuspend ? await waitJob(page, Number(autoSuspend)) : 'none';
  check('suspension automatique réussie', autoSuspendStatus === 'succeeded', autoSuspendStatus);
  await page.goto(`${BASE}/stripe`);
  await shot(page, '19-abonnement-resilie-club-suspendu');
  await stripeEvent('customer.subscription.updated', { ...SUB, status: 'active' }, now);
  await page.goto(`${BASE}/jobs`);
  const autoResume = await page.locator('tr', { hasText: 'Réactivation' }).filter({ hasText: 'règle Stripe' }).first().locator('a').first().textContent();
  const autoResumeStatus = autoResume ? await waitJob(page, Number(autoResume)) : 'none';
  check('paiement revenu : réactivation automatique', autoResumeStatus === 'succeeded', autoResumeStatus);
  await page.goto(`${BASE}/jobs`);
  await shot(page, '20-operations');
  await axe(page, 'opérations');

  // Second server, over (fake) ssh, and the journal.
  await page.goto(`${BASE}/`);
  check('le second serveur (ssh) est relevé', await page.getByRole('heading', { name: /aero2/ }).first().isVisible());
  await page.goto(`${BASE}/audit`);
  check('journal : chaîne intègre', await visible(page, 'Chaîne d’intégrité vérifiée'));
  await shot(page, '21-journal');
  await axe(page, 'journal');
  await page.goto(`${BASE}/account`);
  await axe(page, 'compte');
  await page.goto(`${BASE}/updates`);
  await shot(page, '22-mises-a-jour');
  await axe(page, 'mises à jour');

  // Phone.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, bypassCSP: true, deviceScaleFactor: 2, storageState: await desktop.storageState() });
  const p = await phone.newPage();
  for (const [path, name] of [
    ['/', 'telephone-01-tableau'],
    [`/clubs/aero1/${SLUG}`, 'telephone-02-club'],
    [`/jobs/${updateJob}`, 'telephone-03-operation'],
    ['/stripe', 'telephone-04-abonnements'],
  ] as const) {
    await p.goto(`${BASE}${path}`);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(`téléphone ${path} : pas de défilement horizontal de la page`, !overflow);
    await shot(p, name);
    await axe(p, `téléphone ${path}`);
  }
  await phone.close();

  // Sign out.
  await page.goto(`${BASE}/`);
  await page.getByRole('button', { name: /Se déconnecter/ }).click();
  await page.goto(`${BASE}/`);
  check('déconnecté', page.url().startsWith(`${BASE}/login`));
  // The refused sign-ins above answer 401 on purpose: the browser reports them.
  const unexpected = consoleErrors.filter((e) => !/status of 401/.test(e));
  check('aucune erreur dans la console du navigateur (hors 401 voulus)', unexpected.length === 0, unexpected.join(' | '));
  writeFileSync(join(DIR, 'console-server.log'), serverLog.join(''));
};

const teardown = () => {
  log('nettoyage');
  try {
    browser?.close();
  } catch {
    /* already closed */
  }
  server?.kill('SIGTERM');
  for (const root of [rootA, rootB]) {
    const opt = join(root, 'opt');
    if (!existsSync(opt)) continue;
    for (const club of readdirSync(opt)) {
      const dir = join(opt, club);
      if (existsSync(join(dir, 'docker-compose.yml'))) log('arrêt', club, sh('docker', ['compose', 'down', '-v', '--remove-orphans'], { cwd: dir }).code === 0 ? 'ok' : 'ÉCHEC');
    }
  }
  sh('docker', ['image', 'rm', `${REGISTRY}/backend:${BROKEN}`]);
  const left = sh('docker', ['ps', '-a', '--filter', `label=com.docker.compose.project=skycrew-${SLUG}`, '-q']).out.trim();
  check('plus aucun conteneur du test', left === '', left);
  const volumes = sh('docker', ['volume', 'ls', '-q', '--filter', `name=skycrew-${SLUG}`]).out.trim();
  check('plus aucun volume du test', volumes === '', volumes);
};

let failed = false;
try {
  await main();
} catch (error) {
  failed = true;
  log('ARRÊT :', (error as Error).stack);
} finally {
  await new Promise((r) => setTimeout(r, 500));
  teardown();
  if (process.env.E2E_KEEP_SHOTS) cpSync(SHOTS, process.env.E2E_KEEP_SHOTS, { recursive: true });
  writeFileSync(join(DIR, 'results.json'), JSON.stringify({ results, axe: axeReport }, null, 2));
  const ko = results.filter((r) => !r.ok);
  log(`${results.length - ko.length}/${results.length} vérifications réussies`);
  for (const r of ko) log('KO', r.step, r.note ?? '');
  process.exit(failed || ko.length ? 1 : 0);
}
