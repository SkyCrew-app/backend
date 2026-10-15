import { spawn } from 'node:child_process';
import type { Config, ServerConfig } from '../config.ts';
import * as v from '../validation.ts';

// Every call to the privileged helper goes through here: the same calls work
// on this machine (sudo) and on another server (ssh, then sudo there). The
// arguments are checked here, then again by the helper itself.

export type HelperCall =
  | { action: 'version' | 'status' | 'list' | 'images' }
  | { action: 'backup' | 'suspend' | 'resume'; slug: string }
  | { action: 'enable-site'; slug: string }
  | {
      action: 'create';
      slug: string;
      domain: string;
      adminEmail: string;
      plan: v.Plan;
      maxAircraft: number | null;
      maxMembers: number | null;
      backend: string;
      frontend: string;
      alertWebhook: string | null;
    }
  | { action: 'set-plan'; slug: string; plan: v.Plan; maxAircraft: number | null; maxMembers: number | null }
  | { action: 'update'; slug: string; backend: string | null; frontend: string | null };

const dash = (value: number | string | null): string => (value === null ? '-' : String(value));

/** The command-line arguments of a call, after checking each value again. */
export const helperArguments = (call: HelperCall): { args: string[]; stdin: string } => {
  switch (call.action) {
    case 'version':
    case 'status':
    case 'list':
    case 'images':
      return { args: [call.action], stdin: '' };
    case 'backup':
    case 'suspend':
    case 'resume':
      return { args: [call.action, v.clubSlug(call.slug)], stdin: '' };
    case 'enable-site':
      return { args: [call.action, v.clubSlug(call.slug, { allowFirst: false })], stdin: '' };
    case 'create':
      return {
        args: [
          'create',
          v.clubSlug(call.slug, { allowFirst: false }),
          v.domain(call.domain),
          v.email(call.adminEmail),
          v.plan(call.plan),
          dash(call.maxAircraft === null ? null : v.cap(String(call.maxAircraft), 'maxAircraft')),
          dash(call.maxMembers === null ? null : v.cap(String(call.maxMembers), 'maxMembers')),
          v.version(call.backend),
          v.version(call.frontend),
        ],
        // A webhook address is a secret: on the standard input, never on a command line.
        stdin: `${v.alertWebhook(call.alertWebhook ?? '') ?? ''}\n`,
      };
    case 'set-plan':
      return {
        args: [
          'set-plan',
          v.clubSlug(call.slug),
          v.plan(call.plan),
          dash(call.maxAircraft === null ? null : v.cap(String(call.maxAircraft), 'maxAircraft')),
          dash(call.maxMembers === null ? null : v.cap(String(call.maxMembers), 'maxMembers')),
        ],
        stdin: '',
      };
    case 'update': {
      if (call.backend === null && call.frontend === null) throw new v.ValidationError('version', 'Aucune version demandée.');
      return {
        args: [
          'update',
          v.clubSlug(call.slug),
          dash(call.backend === null ? null : v.version(call.backend)),
          dash(call.frontend === null ? null : v.version(call.frontend)),
        ],
        stdin: '',
      };
    }
  }
};

// For ssh, the remote shell reads the command again: every word is quoted.
export const shellQuote = (word: string): string => `'${word.replace(/'/g, `'\\''`)}'`;

/** The whole command run for a call on a server. */
export const commandFor = (config: Config, server: ServerConfig, call: HelperCall): { argv: string[]; stdin: string } => {
  const { args, stdin } = helperArguments(call);
  if (server.kind === 'local') return { argv: [...config.helperCommand, ...args], stdin };
  return {
    argv: [...config.sshCommand, server.sshHost!, '--', ...[...config.remoteHelperCommand, ...args].map(shellQuote)],
    stdin,
  };
};

export interface RunResult {
  code: number;
  output: string;
  timedOut: boolean;
}

/**
 * Runs a call, giving each line of output (standard output and errors mixed,
 * in order) as it comes. No shell is involved on this machine.
 */
export const runHelper = (
  config: Config,
  server: ServerConfig,
  call: HelperCall,
  options: { onLine?: (line: string, stream: 'out' | 'err') => void; timeoutMs?: number; maxOutput?: number } = {},
): Promise<RunResult> =>
  new Promise((resolve) => {
    let argv: string[];
    let stdin: string;
    try {
      ({ argv, stdin } = commandFor(config, server, call));
    } catch (error) {
      resolve({ code: 64, output: (error as Error).message, timedOut: false });
      return;
    }
    const child = spawn(argv[0], argv.slice(1), {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH ?? '/usr/bin:/bin', LANG: 'C.UTF-8', HOME: process.env.HOME ?? '/', ...extraEnv() },
    });
    let output = '';
    const max = options.maxOutput ?? 2_000_000;
    let timedOut = false;
    const timer = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
        }, options.timeoutMs)
      : null;
    const reader = (stream: 'out' | 'err') => {
      let pending = '';
      return (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        if (output.length < max) output += text;
        pending += text;
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';
        for (const line of lines) options.onLine?.(line, stream);
      };
    };
    child.stdout.on('data', reader('out'));
    child.stderr.on('data', reader('err'));
    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      resolve({ code: 127, output: `${output}${error.message}\n`, timedOut });
    });
    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? (signal ? 128 : 1), output, timedOut });
    });
    child.stdin.end(stdin);
  });

// Tests point the helper to their own settings; in production the helper
// ignores this (sudo resets the environment, and the helper refuses it as root).
const extraEnv = (): Record<string, string> =>
  process.env.SKYCREW_HELPER_CONF ? { SKYCREW_HELPER_CONF: process.env.SKYCREW_HELPER_CONF } : {};
