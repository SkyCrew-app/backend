import { html, type Html } from './html.ts';

export interface PageOptions {
  title: string;
  body: Html;
  // Absent: a page for someone not signed in (no menu).
  nav?: { current: string; csrf: string; owner: string };
  flash?: { kind: 'ok' | 'error' | 'warn'; text: string } | null;
}

const MENU: [string, string][] = [
  ['/', 'Clubs'],
  ['/clubs/new', 'Nouveau club'],
  ['/updates', 'Mises à jour'],
  ['/stripe', 'Abonnements'],
  ['/jobs', 'Opérations'],
  ['/audit', 'Journal'],
  ['/account', 'Compte'],
];

export const page = (o: PageOptions): string =>
  html`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${o.title} · Console SkyCrew</title>
<link rel="stylesheet" href="/static/console.css">
<script src="/static/console.js" defer></script>
</head>
<body>
<a class="skip" href="#contenu">Aller au contenu</a>
<header class="top"><div class="bar">
<a class="brand" href="/">SkyCrew <span>Console</span></a>
${o.nav
  ? html`<nav aria-label="Menu principal"><ul>${MENU.map(
      ([href, label]) => html`<li><a href="${href}"${o.nav!.current === href ? html` aria-current="page"` : ''}>${label}</a></li>`,
    )}</ul></nav>
<form method="post" action="/logout"><input type="hidden" name="_csrf" value="${o.nav.csrf}"><button class="linkish" type="submit">Se déconnecter (${o.nav.owner})</button></form>`
  : ''}
</div></header>
<main id="contenu" tabindex="-1">
${o.flash ? html`<div class="flash ${o.flash.kind}" role="${o.flash.kind === 'error' ? 'alert' : 'status'}">${o.flash.text}</div>` : ''}
${o.body}
</main>
<footer class="foot">Console SkyCrew — aucune donnée des membres des clubs n’est lue ici : seulement l’état des installations et des nombres.</footer>
</body>
</html>`.value;

export const pill = (level: 0 | 1 | 2 | null, text?: string): Html =>
  level === null
    ? html`<span class="pill ln">${text ?? '—'}</span>`
    : html`<span class="pill l${level}"><span aria-hidden="true">${level === 2 ? '✕' : level === 1 ? '▲' : '●'}</span> ${text ?? (level === 2 ? 'Problème' : level === 1 ? 'À voir' : 'OK')}</span>`;

export const csrfField = (csrf: string): Html => html`<input type="hidden" name="_csrf" value="${csrf}">`;

/** The field asking a fresh phone code before a sensitive action, unless one was given minutes ago. */
export const codeField = (elevated: boolean): Html =>
  elevated
    ? html`<p class="muted">Code de l’application déjà donné il y a moins de quelques minutes : pas besoin de le redonner.</p>`
    : html`<div><label for="code">Code de l’application d’authentification <span class="hint">6 chiffres, ou un code de secours. Demandé avant toute action sur un club.</span></label>
<input class="code" id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" required maxlength="20"></div>`;
