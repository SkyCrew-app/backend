#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
// The console's command line, run on the server:
//   skycrew-console serve           the web console (systemd runs this)
//   skycrew-console create-owner    creates the single owner account (password + phone app)
//   skycrew-console reset-2fa       new phone app and new recovery codes (lost phone)
//   skycrew-console set-password    new password
//   skycrew-console unlock          lifts a lock after too many failed sign-ins
//   skycrew-console check           checks the settings and reaches the helper of every server
// Settings: the environment (systemd loads /etc/skycrew-console/console.env;
// on the command line: sudo -u skycrew-console env $(cat ...) or the wrapper
// installed by install.sh).
import { createInterface } from 'node:readline';
import QRCode from 'qrcode';
import { loadConfig } from '../src/config.ts';
import { openDb } from '../src/db.ts';
import { recordAudit } from '../src/audit.ts';
import { createOwner, ownerExists, resetSecondFactor, setPassword, unlockOwner } from '../src/security/auth.ts';
import { passwordProblem } from '../src/security/password.ts';
import { newTotpSecret, otpauthUri, verifyTotp } from '../src/security/totp.ts';
import { runHelper } from '../src/servers/helper.ts';
import { serve } from '../src/main.ts';

const out = (text: string) => process.stdout.write(`${text}\n`);

// Lines typed by the person (or piped). Passwords are not echoed on a terminal.
const lines = createInterface({ input: process.stdin, terminal: false });
const queue: string[] = [];
const waiting: ((line: string) => void)[] = [];
lines.on('line', (line) => (waiting.length ? waiting.shift()!(line) : queue.push(line)));
lines.on('close', () => waiting.splice(0).forEach((resolve) => resolve('')));
const ask = (question: string, hidden = false): Promise<string> => {
  process.stdout.write(question);
  const tty = process.stdin.isTTY;
  if (hidden && tty) process.stdin.setRawMode?.(false);
  return new Promise((resolve) => {
    const done = (line: string) => {
      if (hidden && tty) process.stdout.write('\n');
      resolve(line.trim());
    };
    if (queue.length) done(queue.shift()!);
    else waiting.push(done);
  });
};
// On a terminal, hide what is typed for a password by turning echo off.
const askSecret = async (question: string): Promise<string> => {
  const tty = process.stdin.isTTY;
  if (!tty) return ask(question);
  const { execFileSync } = await import('node:child_process');
  try {
    execFileSync('stty', ['-echo'], { stdio: 'inherit' });
    return await ask(question, true);
  } finally {
    execFileSync('stty', ['echo'], { stdio: 'inherit' });
  }
};

const newPassword = async (): Promise<string> => {
  for (;;) {
    const first = await askSecret('Mot de passe (12 caractères au moins) : ');
    const problem = passwordProblem(first);
    if (problem) {
      out(problem);
      continue;
    }
    if ((await askSecret('Le même, encore : ')) === first) return first;
    out('Les deux diffèrent, recommencez.');
  }
};

const enrolPhone = async (account: string): Promise<string> => {
  const secret = newTotpSecret();
  const uri = otpauthUri(secret, account);
  out('\nDans l’application d’authentification du téléphone (Google Authenticator, Microsoft Authenticator,');
  out('1Password…), ajoutez un compte en scannant ce code :\n');
  out(await QRCode.toString(uri, { type: 'terminal', small: true }));
  out(`ou en tapant cette clé : ${secret.replace(/(.{4})/g, '$1 ').trim()}\n`);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await ask('Code à 6 chiffres affiché par l’application : ');
    if (verifyTotp(secret, code.replace(/\s/g, ''), Date.now(), null) !== null) return secret;
    out('Code incorrect (vérifiez l’heure du téléphone et du serveur), réessayez.');
  }
  throw new Error('trop d’essais : rien n’a été changé');
};

const showCodes = (codes: string[]) => {
  out('\nCodes de secours, à garder hors du téléphone (papier, coffre de mots de passe).');
  out('Chacun remplace une fois le code du téléphone :\n');
  for (const code of codes) out(`   ${code}`);
  out('\nIls ne seront plus jamais affichés.');
};

const main = async () => {
  const command = process.argv[2] ?? 'help';
  if (command === 'serve') {
    const running = await serve();
    const stop = async (signal: string) => {
      out(`${signal} : arrêt après les opérations en cours`);
      await running.close();
      process.exit(0);
    };
    process.on('SIGTERM', () => void stop('SIGTERM'));
    process.on('SIGINT', () => void stop('SIGINT'));
    return;
  }
  const config = loadConfig();
  const db = openDb(config.dbPath);
  switch (command) {
    case 'create-owner': {
      if (ownerExists(db) && !process.argv.includes('--replace')) {
        out('Le compte existe déjà. Pour le remplacer entièrement : create-owner --replace');
        process.exit(1);
      }
      const username = (await ask('Identifiant (minuscules, ex. anthony) : ')).toLowerCase();
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error('identifiant : 3 à 32 caractères a-z, 0-9, point, tiret');
      const password = await newPassword();
      const secret = await enrolPhone(username);
      const codes = await createOwner(db, { username, password, totpSecret: secret });
      recordAudit(db, { actor: 'cli', action: 'account.created', target: username });
      out(`\nCompte « ${username} » créé.`);
      showCodes(codes);
      break;
    }
    case 'reset-2fa': {
      if (!ownerExists(db)) throw new Error('aucun compte : create-owner d’abord');
      const secret = await enrolPhone('owner');
      const codes = resetSecondFactor(db, secret);
      recordAudit(db, { actor: 'cli', action: 'account.2fa.reset' });
      out('\nNouvelle application enregistrée, toutes les sessions sont fermées.');
      showCodes(codes);
      break;
    }
    case 'set-password': {
      if (!ownerExists(db)) throw new Error('aucun compte : create-owner d’abord');
      await setPassword(db, await newPassword());
      recordAudit(db, { actor: 'cli', action: 'account.password.changed' });
      out('Mot de passe changé, toutes les sessions sont fermées.');
      break;
    }
    case 'unlock': {
      unlockOwner(db);
      recordAudit(db, { actor: 'cli', action: 'account.unlocked' });
      out('Compte débloqué.');
      break;
    }
    case 'check': {
      out(`Adresse publique : ${config.publicUrl}`);
      out(`Écoute : ${config.host}:${config.port}`);
      out(`Base : ${config.dbPath}`);
      out(`Notifications Stripe : ${config.stripeWebhookSecret ? 'secret renseigné' : 'pas de secret (STRIPE_WEBHOOK_SECRET)'} ; délai avant suspension : ${config.graceDays} jours`);
      out(`Compte du propriétaire : ${ownerExists(db) ? 'créé' : 'à créer (create-owner)'}`);
      let ok = true;
      for (const server of config.servers) {
        const result = await runHelper(config, server, { action: 'version' }, { timeoutMs: 30_000 });
        ok &&= result.code === 0;
        out(`Serveur ${server.name} (${server.kind}${server.sshHost ? ` ${server.sshHost}` : ''}) : ${result.code === 0 ? result.output.trim() : `INJOIGNABLE (code ${result.code}) ${result.output.trim().split('\n').at(-1) ?? ''}`}`);
      }
      process.exitCode = ok ? 0 : 1;
      break;
    }
    default:
      out('Commandes : serve, create-owner [--replace], reset-2fa, set-password, unlock, check');
      process.exitCode = command === 'help' ? 0 : 64;
  }
  db.close();
  lines.close();
};

main().catch((error: unknown) => {
  process.stderr.write(`ÉCHEC : ${(error as Error).message}\n`);
  process.exit(1);
});
