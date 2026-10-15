import type { AuditEntry } from '../audit.ts';
import type { Images } from '../fleet.ts';
import { JOB_LABELS, STATUS_LABELS, type Job, type LogLine } from '../jobs.ts';
import type { ClubStatus, ServerStatus } from '../servers/status.ts';
import { HANDLED_EVENTS, PAYING, STATUS_FR, clubSettingsOf, suspensionDue, type Subscription } from '../stripe.ts';
import { date, dateTime, duration, html, sizeKb, sizeMb, type Html } from './html.ts';
import { codeField, csrfField, pill } from './layout.ts';

// --- Signing in ---------------------------------------------------------------------

export const loginPage = (preCsrf: string, error: string | null): Html => html`
<div class="login card">
<h1>Connexion</h1>
<p class="sub">Console du propriétaire de SkyCrew.</p>
${error ? html`<p class="error-text" role="alert">${error}</p>` : ''}
<form class="stack" method="post" action="/login">
${csrfField(preCsrf)}
<div><label for="username">Identifiant</label><input id="username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="32"></div>
<div><label for="password">Mot de passe</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"></div>
<div class="actions"><button type="submit">Continuer</button></div>
</form>
</div>`;

export const codePage = (csrf: string, error: string | null): Html => html`
<div class="login card">
<h1>Code de vérification</h1>
<p class="sub">Ouvrez l’application d’authentification de votre téléphone et tapez le code à 6 chiffres de « SkyCrew Console ». Sans votre téléphone : un de vos codes de secours (chacun ne sert qu’une fois).</p>
${error ? html`<p class="error-text" role="alert">${error}</p>` : ''}
<form class="stack" method="post" action="/login/code">
${csrfField(csrf)}
<div><label for="code">Code</label><input class="code" id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" required maxlength="20" autofocus></div>
<div class="actions"><button type="submit">Se connecter</button> <a href="/login">Recommencer</a></div>
</form>
</div>`;

// --- Dashboard ------------------------------------------------------------------------

const plan = (f: Record<string, string>): string => (f.plan === 'club' ? 'Club' : f.plan === 'ecole' ? 'Club + École' : 'complète (par défaut)');
const capOf = (used: string | undefined, max: string | undefined): string => `${used || '?'}${max ? ` / ${max}` : ''}`;
const host = (url: string | undefined): string => (url ?? '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
export const isSuspended = (f: Record<string, string>): boolean => /^(1|true|yes)$/i.test(f.suspended ?? '');

const subscriptionBadge = (sub: Subscription | undefined, graceDays: number): Html => {
  if (!sub) return html`<span class="muted">non relié</span>`;
  const due = suspensionDue(sub, graceDays);
  const level = PAYING.has(sub.status) ? 0 : due ? 1 : null;
  return html`${pill(level as 0 | 1 | null, STATUS_FR[sub.status] ?? sub.status)}${due ? html`<br><small>suspension prévue le ${date(due)}</small>` : ''}`;
};

export const dashboardPage = (input: {
  csrf: string;
  servers: ServerStatus[];
  subscriptions: Map<string, Subscription>;
  graceDays: number;
  active: Job[];
  unlinked: number;
}): Html => {
  const clubs = input.servers.flatMap((s) => s.clubs);
  const counts = [0, 0, 0];
  for (const c of clubs) counts[c.level]++;
  const fetched = Math.min(...input.servers.map((s) => s.fetchedAt));
  return html`
<h1>Clubs</h1>
<p class="sub">État relevé le ${dateTime(fetched)}. ${clubs.length} club(s) sur ${input.servers.length} serveur(s).</p>
<div class="actions">
${pill(0, `${counts[0]} OK`)} ${pill(1, `${counts[1]} à voir`)} ${pill(2, `${counts[2]} problème(s)`)}
<form class="inline" method="post" action="/refresh">${csrfField(input.csrf)}<button class="secondary" type="submit">Actualiser maintenant</button></form>
</div>
${input.active.length ? html`<p class="flash warn">${input.active.length} opération(s) en cours ou en attente : <a href="/jobs">voir les opérations</a>.</p>` : ''}
${input.unlinked ? html`<p class="flash warn">${input.unlinked} abonnement(s) Stripe ne sont reliés à aucun club : <a href="/stripe">les relier</a>.</p>` : ''}

<h2>Serveurs</h2>
<div class="grid">
${input.servers.map(
  (s) => html`<section class="card" aria-label="Serveur ${s.name}">
<h3>${s.name} ${pill(s.level)}</h3>
${s.reachable
  ? html`<p class="big">${s.fit} <small class="muted">club(s) de plus, environ</small></p>
<dl>
<dt>Mémoire libre</dt><dd>${sizeMb(s.facts.mem_avail_mb)} sur ${sizeMb(s.facts.mem_total_mb)}</dd>
<dt>Disque libre</dt><dd>${sizeMb(s.facts.disk_avail_mb)} sur ${sizeMb(s.facts.disk_total_mb)}</dd>
<dt>Processeurs</dt><dd>${s.facts.cpus} (charge ${s.facts.load1})</dd>
<dt>Clubs</dt><dd>${s.clubs.length}, en moyenne ${sizeMb(Math.round(s.averageMemoryMb))} de mémoire et ${sizeMb(Math.round(s.averageDiskMb))} de données</dd>
<dt>D’après</dt><dd>mémoire : ${s.fitMemory}, disque : ${s.fitDisk}</dd>
</dl>`
  : ''}
${s.reasons.length ? html`<ul class="reasons">${s.reasons.map((r) => html`<li>${r}</li>`)}</ul>` : ''}
</section>`,
)}
</div>

<h2>Tous les clubs</h2>
${clubs.length === 0
  ? html`<p>Aucun club trouvé. <a href="/clubs/new">Créer le premier</a>.</p>`
  : html`<div class="table-wrap" role="region" tabindex="0" aria-label="Tableau des clubs"><table class="stacked">
<caption>Classés du plus urgent au plus calme. Les nombres viennent de la base de chaque club, en lecture seule.</caption>
<thead><tr><th scope="col">État</th><th scope="col">Club</th><th scope="col" class="opt">Serveur</th><th scope="col">Formule</th><th scope="col" class="opt">Versions (API / appli)</th><th scope="col" class="opt">Sauvegarde</th><th scope="col">Membres</th><th scope="col">Avions</th><th scope="col" class="opt">Résa. 30 j</th><th scope="col" class="opt">Abonnement</th></tr></thead>
<tbody>
${[...clubs]
  .sort((a, b) => b.level - a.level || a.slug.localeCompare(b.slug))
  .map((c) => {
    const f = c.facts;
    return html`<tr>
<td>${pill(c.level)}${isSuspended(f) ? html`<br>${pill(1, 'suspendu')}` : ''}${c.reasons.length ? html`<ul class="reasons">${c.reasons.map((r) => html`<li>${r}</li>`)}</ul>` : ''}</td>
<th scope="row"><a href="/clubs/${c.server}/${c.slug}">${c.slug}</a><br><small class="muted">${host(f.url) || 'sans adresse'}</small></th>
<td class="opt" data-label="Serveur">${c.server}</td>
<td data-label="Formule">${plan(f)}</td>
<td class="num opt" data-label="Versions">${f.run_backend || f.env_backend || '?'} / ${f.run_frontend || f.env_frontend || '?'}</td>
<td class="opt" data-label="Sauvegarde">${f.backup_last ? html`${f.backup_last}<br><small class="muted">${sizeKb(f.backup_db_kb)}</small>` : 'aucune'}</td>
<td class="num" data-label="Membres">${capOf(f.members, f.max_members)}</td>
<td class="num" data-label="Avions">${capOf(f.aircraft, f.max_aircraft)}</td>
<td class="num opt" data-label="Résa. 30 j">${f.bookings30 || '?'}</td>
<td class="opt" data-label="Abonnement">${subscriptionBadge(input.subscriptions.get(`${c.server}:${c.slug}`), input.graceDays)}</td>
</tr>`;
  })}
</tbody></table></div>`}`;
};

// --- One club -----------------------------------------------------------------------

const versionOptions = (versions: string[], current: string | undefined, allowKeep: boolean): Html =>
  html`${allowKeep ? html`<option value="">ne pas changer</option>` : ''}${versions.map(
    (v) => html`<option value="${v}"${v === current && !allowKeep ? html` selected` : ''}>${v}${v === current ? ' (actuelle)' : ''}</option>`,
  )}`;

export const clubPage = (input: {
  csrf: string;
  club: ClubStatus;
  images: Images;
  subscription: Subscription | undefined;
  suspendedBy: 'owner' | 'stripe' | null;
  graceDays: number;
  jobs: Job[];
}): Html => {
  const c = input.club;
  const f = c.facts;
  const target = html`<input type="hidden" name="server" value="${c.server}"><input type="hidden" name="slug" value="${c.slug}"><input type="hidden" name="step" value="review">${csrfField(input.csrf)}`;
  const suspended = isSuspended(f);
  return html`
<p><a href="/">← Tous les clubs</a></p>
<h1>${c.slug} ${pill(c.level)} ${suspended ? pill(1, 'suspendu') : ''}</h1>
<p class="sub">Serveur ${c.server} · ${f.url ? html`<a href="${f.url}" rel="noopener noreferrer">${host(f.url)}</a>` : 'sans adresse publique'}</p>
${c.reasons.length ? html`<div class="card"><h2 style="margin-top:0">À regarder</h2><ul class="summary-list">${c.reasons.map((r) => html`<li>${r}</li>`)}</ul></div>` : ''}

<h2>État</h2>
<div class="grid">
<section class="card" aria-label="Installation"><h3>Installation</h3><dl>
<dt>Formule</dt><dd>${plan(f)}</dd>
<dt>Avions en service</dt><dd>${capOf(f.aircraft, f.max_aircraft)}${f.max_aircraft ? '' : ' (sans limite)'}</dd>
<dt>Membres actifs</dt><dd>${capOf(f.members, f.max_members)}${f.max_members ? '' : ' (sans limite)'}</dd>
<dt>Réservations 30 j</dt><dd>${f.bookings30 || '?'}</dd>
<dt>API</dt><dd>${f.run_backend || '?'}${f.env_backend && f.env_backend !== f.run_backend ? ` (.env : ${f.env_backend})` : ''}</dd>
<dt>Application</dt><dd>${f.run_frontend || '?'}${f.env_frontend && f.env_frontend !== f.run_frontend ? ` (.env : ${f.env_frontend})` : ''}</dd>
<dt>Conteneurs</dt><dd>${c.containers} en marche</dd>
<dt>Port local</dt><dd>${f.port}</dd>
<dt>Répond</dt><dd>sur le serveur : ${f.local_ready === '200' ? 'oui' : 'non'} · à son adresse : ${f.domain_ready === '200' ? 'oui' : 'non'}</dd>
</dl></section>
<section class="card" aria-label="Sauvegardes et ressources"><h3>Sauvegardes et ressources</h3><dl>
<dt>Dernière sauvegarde</dt><dd>${f.backup_last || 'aucune'}${f.backup_db_kb ? ` (base ${sizeKb(f.backup_db_kb)})` : ''}</dd>
<dt>Sauvegarde chaque nuit</dt><dd>${f.backup_cron === 'yes' ? 'oui' : 'non'}</dd>
<dt>Toutes les sauvegardes</dt><dd>${sizeKb(f.backups_total_kb)}</dd>
<dt>Données</dt><dd>${sizeKb(c.diskKb)}</dd>
<dt>Mémoire</dt><dd>${sizeMb(f.mem_mb)}</dd>
<dt>Processeur</dt><dd>${f.cpu_pct || '0'} %</dd>
<dt>Veilleur de panne</dt><dd>${f.watch_installed === 'yes' ? (f.watch_target === 'yes' ? 'installé, avec destinataire' : 'installé, sans destinataire') : 'absent'}${f.watch_last ? ` · dernière alerte ${f.watch_last}` : ''}</dd>
</dl></section>
<section class="card" aria-label="Abonnement"><h3>Abonnement Stripe</h3>
${input.subscription
  ? html`<dl><dt>Statut</dt><dd>${subscriptionBadge(input.subscription, input.graceDays)}</dd>
<dt>Client</dt><dd>${input.subscription.club_name || '—'}</dd>
<dt>Offre</dt><dd>${input.subscription.tier || '—'} ${input.subscription.cycle ? `(${input.subscription.cycle})` : ''}, ${input.subscription.aircraft ?? '?'} avion(s)</dd></dl>`
  : html`<p class="muted">Aucun abonnement relié.</p>`}
<p><a href="/stripe">Gérer les abonnements</a></p>
${input.suspendedBy ? html`<p>Suspendu ${input.suspendedBy === 'stripe' ? 'automatiquement (abonnement impayé)' : 'à la main'}.</p>` : ''}
</section>
</div>

<h2>Actions</h2>
<p class="muted">Chaque action demande une confirmation, puis s’exécute en arrière-plan ; une seule à la fois par club.</p>
<div class="grid">
<form class="card stack" method="post" action="/act/backup">${target}<h3>Sauvegarder maintenant</h3><p class="muted">Base, fichiers et réglages du club, en plus de la sauvegarde de chaque nuit.</p><div class="actions"><button type="submit">Sauvegarder…</button></div></form>

<form class="card stack" method="post" action="/act/set-plan">${target}<h3>Formule et limites</h3>
<fieldset><legend>Formule</legend>
<label class="check"><input type="radio" name="plan" value="club"${f.plan === 'club' ? html` checked` : ''}> Club (tout sauf l’instruction)</label>
<label class="check"><input type="radio" name="plan" value="ecole"${f.plan !== 'club' ? html` checked` : ''}> Club + École (tout)</label>
</fieldset>
<div><label for="maxAircraft">Avions en service permis <span class="hint">vide = sans limite</span></label><input id="maxAircraft" name="maxAircraft" type="text" inputmode="numeric" value="${f.max_aircraft ?? ''}" maxlength="5"></div>
<div><label for="maxMembers">Membres actifs permis <span class="hint">vide = sans limite</span></label><input id="maxMembers" name="maxMembers" type="text" inputmode="numeric" value="${f.max_members ?? ''}" maxlength="5"></div>
<div class="actions"><button type="submit">Changer…</button></div></form>

<form class="card stack" method="post" action="/act/update">${target}<h3>Mettre à jour ce club</h3>
<div><label for="backend">Version de l’API</label><select id="backend" name="backend">${versionOptions(input.images.backend, f.env_backend, true)}</select></div>
<div><label for="frontend">Version de l’application</label><select id="frontend" name="frontend">${versionOptions(input.images.frontend, f.env_frontend, true)}</select></div>
<p class="muted">Sauvegarde, bascule, puis retour tout seul aux versions actuelles si les nouvelles ne répondent pas dans les 2 minutes.</p>
<div class="actions"><button type="submit">Mettre à jour…</button></div></form>

<form class="card stack" method="post" action="/act/${suspended ? 'resume' : 'suspend'}">${target}<h3>${suspended ? 'Réactiver le club' : 'Suspendre le club'}</h3>
<p class="muted">${suspended
  ? 'Les membres retrouvent leur espace tel qu’ils l’ont laissé.'
  : 'Les membres voient « service suspendu » et ne peuvent plus rien modifier. Rien n’est effacé ; la réactivation rend tout.'}</p>
<div class="actions"><button type="submit" class="${suspended ? '' : 'danger'}">${suspended ? 'Réactiver…' : 'Suspendre…'}</button></div></form>

${c.slug !== 'skycrew'
  ? html`<form class="card stack" method="post" action="/act/enable-site">${target}<h3>Activer le site (nginx + HTTPS)</h3>
<p class="muted">À faire une fois, après la création, quand l’adresse ${host(f.url)} pointe vers le serveur. Active le site du club dans nginx (vérifié avant rechargement) et obtient le certificat HTTPS.</p>
<div class="actions"><button type="submit" class="secondary">Activer le site…</button></div></form>`
  : ''}
</div>

<h2>Dernières opérations</h2>
${jobsTable(input.jobs)}`;
};

export const jobsTable = (jobs: Job[]): Html =>
  jobs.length === 0
    ? html`<p class="muted">Aucune opération.</p>`
    : html`<div class="table-wrap" role="region" tabindex="0" aria-label="Tableau, défilable"><table><thead><tr><th scope="col">N°</th><th scope="col">Quoi</th><th scope="col">Club</th><th scope="col">Par</th><th scope="col">Demandée</th><th scope="col">État</th><th scope="col" class="opt">Résultat</th></tr></thead><tbody>
${jobs.map(
  (j) => html`<tr><td class="num"><a href="/jobs/${j.id}">${j.id}</a></td><td>${JOB_LABELS[j.kind]}</td><td>${j.slug ? `${j.slug} (${j.server})` : j.server}</td><td>${actorLabel(j.actor)}</td><td class="num">${dateTime(j.createdAt)}</td><td>${jobPill(j)}</td><td class="opt">${j.summary ?? ''}</td></tr>`,
)}</tbody></table></div>`;

export const actorLabel = (actor: string): string => (actor === 'stripe' ? 'règle Stripe' : actor === 'console' ? 'console' : actor);

export const jobPill = (j: Job): Html =>
  pill(j.status === 'succeeded' ? 0 : j.status === 'running' || j.status === 'queued' ? null : j.status === 'cancelled' ? null : j.status === 'rolled_back' ? 1 : 2, STATUS_LABELS[j.status]);

// --- Review / confirmation ------------------------------------------------------------

export const reviewPage = (input: {
  csrf: string;
  action: string;
  title: string;
  lines: (Html | string)[];
  warnings: string[];
  hidden: Record<string, string>;
  elevated: boolean;
  needsCode: boolean;
  danger: boolean;
  back: string;
  error?: string | null;
}): Html => html`
<p><a href="${input.back}">← Retour</a></p>
<h1>${input.title}</h1>
<p class="sub">Vérifiez avant de confirmer. L’action sera inscrite au journal.</p>
${input.error ? html`<p class="flash error" role="alert">${input.error}</p>` : ''}
<div class="card"><ul class="summary-list">${input.lines.map((l) => html`<li>${l}</li>`)}</ul></div>
${input.warnings.map((w) => html`<p class="flash warn">${w}</p>`)}
<form class="stack" method="post" action="/act/${input.action}">
${csrfField(input.csrf)}<input type="hidden" name="step" value="run">
${Object.entries(input.hidden).map(([k, v]) => html`<input type="hidden" name="${k}" value="${v}">`)}
${input.needsCode ? codeField(input.elevated) : ''}
<div class="actions"><button type="submit"${input.danger ? html` class="danger"` : ''}>Confirmer</button> <a class="button secondary" href="${input.back}">Annuler</a></div>
</form>`;

// --- Forms ----------------------------------------------------------------------------

export interface NewClubValues {
  server?: string;
  slug?: string;
  domain?: string;
  adminEmail?: string;
  plan?: string;
  maxAircraft?: string;
  maxMembers?: string;
  backend?: string;
  frontend?: string;
  subscription?: string;
}

export const newClubPage = (input: {
  csrf: string;
  servers: ServerStatus[];
  images: Images;
  values: NewClubValues;
  subscriptions: Subscription[];
  error?: string | null;
}): Html => {
  const v = input.values;
  return html`
<h1>Nouveau club</h1>
<p class="sub">Les étapes de <code>new-club.sh</code> : dossier, secrets tirés au hasard, base, sauvegarde chaque nuit, veilleur de panne, démarrage. Rien d’existant n’est touché.</p>
${input.error ? html`<p class="flash error" role="alert">${input.error}</p>` : ''}
<form class="stack" method="post" action="/act/create">
${csrfField(input.csrf)}<input type="hidden" name="step" value="review">
<div><label for="server">Serveur</label><select id="server" name="server">${input.servers.map(
    (s) => html`<option value="${s.name}"${v.server === s.name ? html` selected` : ''}>${s.name} — place pour environ ${s.fit} club(s)</option>`,
  )}</select></div>
<div><label for="slug">Nom court du club <span class="hint">3 à 31 caractères : minuscules, chiffres, tirets (ex. aeroclub-vexin). Définitif.</span></label><input id="slug" name="slug" type="text" required maxlength="31" pattern="[a-z][a-z0-9\\-]{1,29}[a-z0-9]" autocapitalize="none" spellcheck="false" value="${v.slug ?? ''}"></div>
<div><label for="domain">Adresse du club <span class="hint">sans https:// (ex. vexin.skycrew.fr). Faites-la pointer vers le serveur chez le fournisseur du nom de domaine.</span></label><input id="domain" name="domain" type="text" required maxlength="253" autocapitalize="none" spellcheck="false" value="${v.domain ?? ''}"></div>
<div><label for="adminEmail">E-mail du premier administrateur du club</label><input id="adminEmail" name="adminEmail" type="email" required maxlength="254" value="${v.adminEmail ?? ''}"></div>
<fieldset><legend>Formule</legend>
<label class="check"><input type="radio" name="plan" value="club"${v.plan === 'club' ? html` checked` : ''} required> Club (tout sauf l’instruction)</label>
<label class="check"><input type="radio" name="plan" value="ecole"${v.plan === 'ecole' ? html` checked` : ''}> Club + École (tout)</label>
</fieldset>
<div><label for="maxAircraft">Avions en service permis <span class="hint">vide = sans limite</span></label><input id="maxAircraft" name="maxAircraft" type="text" inputmode="numeric" maxlength="5" value="${v.maxAircraft ?? ''}"></div>
<div><label for="maxMembers">Membres actifs permis <span class="hint">vide = sans limite</span></label><input id="maxMembers" name="maxMembers" type="text" inputmode="numeric" maxlength="5" value="${v.maxMembers ?? ''}"></div>
<div><label for="backend">Version de l’API</label><select id="backend" name="backend" required>${versionOptions(input.images.backend, v.backend, false)}</select></div>
<div><label for="frontend">Version de l’application</label><select id="frontend" name="frontend" required>${versionOptions(input.images.frontend, v.frontend, false)}</select></div>
<div><label for="alertWebhook">Webhook d’alerte de panne <span class="hint">facultatif : adresse https:// d’un salon Discord ou Slack. Jamais affichée ensuite.</span></label><input id="alertWebhook" name="alertWebhook" type="url" maxlength="500" autocomplete="off"></div>
<div><label for="subscription">Abonnement Stripe à relier <span class="hint">facultatif</span></label><select id="subscription" name="subscription"><option value="">aucun</option>${input.subscriptions.map(
    (s) => html`<option value="${s.id}"${v.subscription === s.id ? html` selected` : ''}>${s.club_name || s.id} — ${STATUS_FR[s.status] ?? s.status}</option>`,
  )}</select></div>
<div class="actions"><button type="submit">Vérifier…</button></div>
</form>`;
};

export const updatesPage = (input: { csrf: string; clubs: ClubStatus[]; images: Images; error?: string | null }): Html => html`
<h1>Mettre à jour plusieurs clubs</h1>
<p class="sub">Les clubs choisis passent l’un après l’autre : sauvegarde, bascule, attente qu’il réponde (2 minutes au plus), retour tout seul à l’ancienne version sinon. Chaque club n’est coupé qu’environ 30 secondes. Conseil : un club d’abord, puis les autres.</p>
${input.error ? html`<p class="flash error" role="alert">${input.error}</p>` : ''}
<form class="stack" method="post" action="/act/update-all">
${csrfField(input.csrf)}<input type="hidden" name="step" value="review">
<div><label for="backend">Version de l’API</label><select id="backend" name="backend">${versionOptions(input.images.backend, undefined, true)}</select></div>
<div><label for="frontend">Version de l’application</label><select id="frontend" name="frontend">${versionOptions(input.images.frontend, undefined, true)}</select></div>
<fieldset><legend>Clubs</legend>
${input.clubs.map(
  (c) => html`<label class="check"><input type="checkbox" name="targets" value="${c.server}:${c.slug}" checked> ${c.slug} <span class="muted">(${c.server}, actuellement ${c.facts.env_backend || '?'} / ${c.facts.env_frontend || '?'})</span></label>`,
)}
</fieldset>
<label class="check"><input type="checkbox" name="continueOnError" value="1"> Continuer avec les clubs suivants même si un club échoue</label>
<p class="muted">Seules les versions présentes sur les serveurs sont proposées (voir « Images » dans le README de la console).</p>
<div class="actions"><button type="submit">Vérifier…</button></div>
</form>`;

// --- Jobs -----------------------------------------------------------------------------

export const jobPage = (input: { csrf: string; job: Job; lines: LogLine[]; children: Job[]; hasPassword: boolean; password: string | null; elevated: boolean }): Html => {
  const j = input.job;
  const finished = !['queued', 'running'].includes(j.status);
  const last = input.lines.at(-1)?.seq ?? 0;
  return html`
<p><a href="/jobs">← Toutes les opérations</a>${j.slug ? html` · <a href="/clubs/${j.server}/${j.slug}">${j.slug}</a>` : ''}</p>
<h1>${JOB_LABELS[j.kind]} ${j.slug ? `: ${j.slug}` : ''}</h1>
<p class="sub">Opération n° ${j.id} · serveur ${j.server} · demandée par ${actorLabel(j.actor)} le ${dateTime(j.createdAt)}${j.finishedAt && j.startedAt ? ` · durée ${duration(j.finishedAt - j.startedAt)}` : ''}</p>
<p>État : <strong id="job-status" aria-live="polite">${STATUS_LABELS[j.status]}</strong>${j.summary ? html` — ${j.summary}` : ''}</p>
${input.password
  ? html`<div class="card"><h2 style="margin-top:0">Mot de passe provisoire du premier administrateur</h2><p><span class="secret">${input.password}</span></p><p>Affiché <strong>cette seule fois</strong> : notez-le et transmettez-le à l’administrateur du club par un moyen sûr (de vive voix, SMS), jamais dans le même e-mail que l’adresse du site. Il le change dans « Mon profil » à sa première connexion.</p></div>`
  : input.hasPassword
    ? html`<form class="card stack" method="post" action="/jobs/${j.id}/password">${csrfField(input.csrf)}<h2 style="margin-top:0">Mot de passe provisoire</h2><p>Le mot de passe du premier administrateur du club peut être affiché une seule fois (pendant 30 minutes après la création).</p>${codeField(input.elevated)}<div class="actions"><button type="submit">Afficher le mot de passe</button></div></form>`
    : ''}
${j.kind === 'create' && j.status === 'succeeded'
  ? html`<div class="card"><h2 style="margin-top:0">Ensuite</h2><ol><li>Vérifiez que l’adresse du club pointe vers le serveur (enregistrement DNS de type A).</li><li>Sur la page du club, « Activer le site » : nginx puis HTTPS.</li><li>Renseignez les réglages d’envoi d’e-mails du club (README du kit, étape 6) avant qu’il invite ses membres.</li></ol></div>`
  : ''}
${input.children.length ? html`<h2>Clubs</h2>${jobsTable(input.children)}` : ''}
${!finished && (j.status === 'queued' || j.kind === 'update-all')
  ? html`<form method="post" action="/jobs/${j.id}/cancel">${csrfField(input.csrf)}<button class="secondary" type="submit">${j.status === 'queued' ? 'Annuler cette opération' : 'Arrêter après le club en cours'}</button></form>`
  : ''}
<h2>Journal</h2>
<pre class="log" id="job-log" tabindex="0" aria-label="Journal de l’opération" data-src="/jobs/${j.id}/log.json" data-after="${last}" data-finished="${finished ? '1' : '0'}">${input.lines.map((l) => `${l.line}\n`).join('')}</pre>`;
};

export const jobsPage = (jobs: Job[]): Html => html`<h1>Opérations</h1><p class="sub">Les 100 dernières. Une seule opération à la fois par club ; celles en attente démarrent dès que le club est libre.</p>${jobsTable(jobs)}`;

// --- Stripe ---------------------------------------------------------------------------

export const stripePage = (input: {
  csrf: string;
  configured: boolean;
  webhookUrl: string;
  graceDays: number;
  subscriptions: Subscription[];
  clubs: ClubStatus[];
  events: { id: string; type: string; received_at: number; livemode: number; subscription: string | null; outcome: string }[];
}): Html => html`
<h1>Abonnements</h1>
<p class="sub">Les abonnements pris sur le site vitrine (Stripe). La console ne détient aucune clé Stripe : elle reçoit seulement les notifications signées de Stripe.</p>
${input.configured
  ? html`<p class="flash ok">Notifications Stripe : configurées. Adresse : <code>${input.webhookUrl}</code></p>`
  : html`<p class="flash warn">Notifications Stripe pas encore configurées : voir « Relier Stripe » dans le README de la console. Adresse à déclarer : <code>${input.webhookUrl}</code></p>`}
<div class="card"><h2 style="margin-top:0">La règle des impayés</h2>
<ul class="summary-list">
<li>Un abonnement cesse de payer quand Stripe le dit en retard, impayé, résilié, en pause, ou qu’une facture échoue.</li>
<li>Son club est suspendu automatiquement <strong>${input.graceDays} jours</strong> après, s’il n’a pas payé entre-temps (le temps des nouvelles tentatives de paiement de Stripe et d’un échange avec le club).</li>
<li>Dès que Stripe le dit de nouveau actif, le club suspendu par cette règle est réactivé automatiquement. Un club suspendu à la main n’est jamais réactivé par Stripe.</li>
<li>Rien n’est jamais effacé. Pour garder ouvert un club en retard, détachez son abonnement.</li>
</ul></div>
<h2>Abonnements reçus</h2>
${input.subscriptions.length === 0
  ? html`<p class="muted">Aucun pour l’instant : ils apparaissent ici à la première notification de Stripe.</p>`
  : html`<div class="table-wrap" role="region" tabindex="0" aria-label="Tableau, défilable"><table><thead><tr><th scope="col">Client</th><th scope="col">Offre</th><th scope="col">Statut</th><th scope="col">Club relié</th></tr></thead><tbody>
${input.subscriptions.map((s) => {
  const due = suspensionDue(s, input.graceDays);
  const settings = clubSettingsOf(s);
  return html`<tr>
<th scope="row">${s.club_name || 'club inconnu'}<br><small class="muted">${s.contact_name || ''} ${s.contact_email || ''}</small><br><small class="muted">${s.id}${s.livemode ? '' : ' · test'}</small></th>
<td>${s.tier || '—'}${s.cycle ? ` (${s.cycle === 'yearly' ? 'annuel' : 'mensuel'})` : ''}<br><small class="muted">${s.aircraft ?? '?'} avion(s)${s.current_period_end ? ` · période jusqu’au ${date(s.current_period_end * 1000)}` : ''}${s.cancel_at_period_end ? ' · résiliation demandée' : ''}</small></td>
<td>${pill(PAYING.has(s.status) ? 0 : due ? 1 : null, STATUS_FR[s.status] ?? s.status)}${s.unpaid_since ? html`<br><small>sans paiement depuis le ${date(s.unpaid_since)}${due ? `, suspension le ${date(due)}` : ''}</small>` : ''}</td>
<td><form class="stack" method="post" action="/act/link-subscription">${csrfField(input.csrf)}<input type="hidden" name="step" value="review"><input type="hidden" name="subscription" value="${s.id}">
<label class="sr-only" for="club-${s.id}">Club relié à ${s.club_name || s.id}</label>
<select id="club-${s.id}" name="club"><option value="">aucun</option>${input.clubs.map(
    (c) => html`<option value="${c.server}:${c.slug}"${s.server === c.server && s.slug === c.slug ? html` selected` : ''}>${c.slug} (${c.server})</option>`,
  )}</select>
<div class="actions"><button class="secondary" type="submit">Relier…</button>${!s.slug
    ? html` <a href="/clubs/new?subscription=${s.id}">Créer son club${settings.plan ? ` (${settings.plan === 'club' ? 'Club' : 'Club + École'}${settings.maxAircraft ? `, ${settings.maxAircraft} avions` : ''})` : ''}</a>`
    : ''}</div></form></td>
</tr>`;
})}</tbody></table></div>`}
<h2>Dernières notifications</h2>
${input.events.length === 0
  ? html`<p class="muted">Aucune.</p>`
  : html`<div class="table-wrap" role="region" tabindex="0" aria-label="Tableau, défilable"><table><thead><tr><th scope="col">Reçue</th><th scope="col">Type</th><th scope="col" class="opt">Abonnement</th><th scope="col">Effet</th></tr></thead><tbody>
${input.events.map((e) => html`<tr><td class="num">${dateTime(e.received_at)}</td><td>${e.type}${e.livemode ? '' : ' (test)'}</td><td class="opt">${e.subscription ?? '—'}</td><td>${e.outcome}</td></tr>`)}
</tbody></table></div>`}
<p class="muted">Événements à cocher dans Stripe : ${HANDLED_EVENTS.join(', ')}.</p>`;

// --- Audit and account ----------------------------------------------------------------

export const auditPage = (input: { entries: AuditEntry[]; chainOk: boolean; brokenAt: number | null; next: number | null }): Html => html`
<h1>Journal</h1>
<p class="sub">Tout ce qui a été fait ou tenté depuis la console, sans possibilité de modifier ni d’effacer. Copie aussi dans le journal du serveur (<code>journalctl -u skycrew-console</code>).</p>
${input.chainOk ? html`<p class="flash ok">Chaîne d’intégrité vérifiée : aucune entrée modifiée ni retirée.</p>` : html`<p class="flash error" role="alert">Chaîne d’intégrité rompue à l’entrée ${input.brokenAt} : le fichier de la console a été modifié hors de la console.</p>`}
<div class="table-wrap" role="region" tabindex="0" aria-label="Tableau, défilable"><table><thead><tr><th scope="col">Quand</th><th scope="col">Qui</th><th scope="col">Action</th><th scope="col">Sur</th><th scope="col">Résultat</th><th scope="col" class="opt">Détails</th></tr></thead><tbody>
${input.entries.map(
  (e) => html`<tr><td class="num">${dateTime(e.at)}</td><td>${actorLabel(e.actor)}<br><small class="muted">${e.ip}</small></td><td>${e.action}</td><td>${e.target}</td><td>${pill(e.outcome === 'ok' ? 0 : e.outcome === 'warning' ? 1 : 2, e.outcome)}</td><td class="opt"><small>${e.details.length > 300 ? `${e.details.slice(0, 300)}…` : e.details}</small></td></tr>`,
)}
</tbody></table></div>
${input.next ? html`<p><a href="/audit?before=${input.next}">Entrées plus anciennes →</a></p>` : ''}`;

export const accountPage = (input: { csrf: string; owner: string; recoveryLeft: number; error?: string | null }): Html => html`
<h1>Compte</h1>
<p class="sub">Un seul compte : ${input.owner}. Il se crée et se répare sur le serveur, en ligne de commande (README, « Se connecter »).</p>
<div class="card"><p>Codes de secours restants : <strong>${input.recoveryLeft}</strong> sur 10.${input.recoveryLeft <= 3 ? ' Pensez à en générer de nouveaux (commande reset-2fa sur le serveur).' : ''}</p></div>
<h2>Changer le mot de passe</h2>
${input.error ? html`<p class="flash error" role="alert">${input.error}</p>` : ''}
<form class="stack" method="post" action="/account/password">
${csrfField(input.csrf)}
<div><label for="current">Mot de passe actuel</label><input id="current" name="current" type="password" autocomplete="current-password" required maxlength="256"></div>
<div><label for="next">Nouveau mot de passe <span class="hint">12 caractères au moins ; une phrase de plusieurs mots convient bien</span></label><input id="next" name="next" type="password" autocomplete="new-password" required minlength="12" maxlength="256"></div>
<div><label for="again">Nouveau mot de passe, encore</label><input id="again" name="again" type="password" autocomplete="new-password" required minlength="12" maxlength="256"></div>
${codeField(false)}
<div class="actions"><button type="submit">Changer le mot de passe</button></div>
</form>
<p class="muted">Après le changement, toutes les sessions sont fermées : reconnectez-vous.</p>`;

export const errorPage = (status: number, message: string): Html => html`<h1>${status === 404 ? 'Page introuvable' : 'Action impossible'}</h1><p>${message}</p><p><a href="/">Retour aux clubs</a></p>`;
