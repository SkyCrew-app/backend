import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { commandFor, helperArguments, shellQuote } from '../src/servers/helper.ts';
import { CONSOLE_DIR, makeKit, tempDir, testConfig, writeConf } from './support.ts';

const HELPER = join(CONSOLE_DIR, 'helper', 'skycrew-console-helper');

test('the console checks every argument before calling the helper', () => {
  assert.deepEqual(helperArguments({ action: 'backup', slug: 'vexin' }).args, ['backup', 'vexin']);
  assert.deepEqual(helperArguments({ action: 'update', slug: 'vexin', backend: '2.19.0', frontend: null }).args, ['update', 'vexin', '2.19.0', '-']);
  assert.deepEqual(
    helperArguments({ action: 'create', slug: 'vexin', domain: 'vexin.skycrew.fr', adminEmail: 'p@vexin.fr', plan: 'club', maxAircraft: 3, maxMembers: null, backend: '2.19.0', frontend: '2.15.0', alertWebhook: 'https://discord.com/api/webhooks/1/x' }),
    { args: ['create', 'vexin', 'vexin.skycrew.fr', 'p@vexin.fr', 'club', '3', '-', '2.19.0', '2.15.0'], stdin: 'https://discord.com/api/webhooks/1/x\n' },
    'the webhook goes on the standard input, never on the command line',
  );
  assert.throws(() => helperArguments({ action: 'backup', slug: 'x;reboot' }));
  assert.throws(() => helperArguments({ action: 'enable-site', slug: 'skycrew' }));
  assert.throws(() => helperArguments({ action: 'update', slug: 'vexin', backend: null, frontend: null }));
  assert.throws(() => helperArguments({ action: 'set-plan', slug: 'vexin', plan: 'x' as 'club', maxAircraft: null, maxMembers: null }));
});

test('local and ssh servers: the same call, quoted for the remote shell', () => {
  const config = testConfig();
  const local = commandFor(config, config.servers[0], { action: 'backup', slug: 'vexin' });
  assert.deepEqual(local.argv, ['sudo', '-n', '/usr/local/sbin/skycrew-console-helper', 'backup', 'vexin']);
  const remote = commandFor(config, config.servers[1], { action: 'backup', slug: 'vexin' });
  assert.deepEqual(remote.argv, ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'beta-host', '--', "'sudo'", "'-n'", "'/usr/local/sbin/skycrew-console-helper'", "'backup'", "'vexin'"]);
  assert.equal(shellQuote("a'b"), `'a'\\''b'`);
});

// The helper itself, run as an ordinary user against an empty server tree.
const sandbox = () => {
  const dir = tempDir('helper');
  const kit = makeKit(dir);
  mkdirSync(join(dir, 'root', 'opt'), { recursive: true });
  const conf = join(dir, 'helper.conf');
  writeConf(conf, { KIT_DIR: kit, SERVER_ROOT: join(dir, 'root'), LOCK_DIR: join(dir, 'lock') });
  const run = (args: string[], stdin = '') =>
    spawnSync('sh', [HELPER, ...args], { input: stdin, encoding: 'utf8', env: { PATH: process.env.PATH, SKYCREW_HELPER_CONF: conf } });
  return { dir, conf, run };
};

test('the helper refuses every argument outside its rules (exit 64), before doing anything', () => {
  const { dir, run } = sandbox();
  const marker = join(dir, 'pwned');
  const refused: string[][] = [
    [],
    ['rm'],
    ['status', 'extra'],
    ['backup'],
    ['backup', `$(touch ${marker})`],
    ['backup', 'a;touch x'],
    ['backup', 'vexin\nskycrew'],
    ['backup', '../etc'],
    ['suspend', 'Vexin'],
    ['update', 'vexin', '2.19', '-'],
    ['update', 'vexin', '2.19.0;id', '-'],
    ['update', 'vexin', '-', '-'],
    ['set-plan', 'vexin', 'gold', '-', '-'],
    ['set-plan', 'vexin', 'club', '0', '-'],
    ['set-plan', 'vexin', 'club', '3', '1e5'],
    ['enable-site', 'skycrew'],
    ['create', 'skycrew', 'a.fr', 'a@b.fr', 'club', '-', '-', '2.19.0', '2.15.0'],
    ['create', 'vexin', 'https://a.fr', 'a@b.fr', 'club', '-', '-', '2.19.0', '2.15.0'],
    ['create', 'vexin', 'a.fr', "a'@b.fr", 'club', '-', '-', '2.19.0', '2.15.0'],
    ['create', 'vexin', 'a.fr', 'a@b.fr', 'club', '-', '-', '2.19.0'],
  ];
  for (const args of refused) {
    const r = run(args);
    assert.equal(r.status, 64, `${JSON.stringify(args)} → ${r.status} ${r.stderr}`);
  }
  const webhook = run(['create', 'vexin', 'a.fr', 'a@b.fr', 'club', '-', '-', '2.19.0', '2.15.0'], `https://x.fr/$(touch ${marker})\n`);
  assert.equal(webhook.status, 64, webhook.stderr);
  assert.equal(existsSync(marker), false, 'nothing was ever run');
});

test('the helper accepts valid arguments and goes on to its next check', () => {
  const { dir, conf, run } = sandbox();
  writeConf(conf, { KIT_DIR: join(dir, 'kit'), SERVER_ROOT: join(dir, 'root'), LOCK_DIR: join(dir, 'lock'), REGISTRY: 'skycrew-absent-test' });
  const r = run(['create', 'aeroclub-vexin', 'vexin.skycrew.fr', 'president@aeroclub-vexin.fr', 'ecole', '3', '-', '2.19.0', '2.15.0'], 'https://discord.com/api/webhooks/123456/AbC-dEf_ghi\n');
  assert.equal(r.status, 5, `${r.stdout}${r.stderr}`);
  assert.match(r.stderr, /image skycrew-absent-test\/backend:2\.19\.0 absente/);
});

test('the helper answers its read-only actions on an empty server', () => {
  const { run } = sandbox();
  assert.equal(run(['version']).stdout.trim(), 'skycrew-console-helper 1');
  const list = run(['list']);
  assert.equal(list.status, 0, list.stderr);
  assert.equal(list.stdout, '');
  assert.equal(run(['backup', 'vexin']).status, 3, 'unknown club');
  assert.equal(run(['suspend', 'vexin']).status, 3);
});

test('the helper refuses a settings file with odd values', () => {
  const { dir, conf, run } = sandbox();
  writeConf(conf, { KIT_DIR: join(dir, 'kit'), IMAGE_SOURCE: 'build' });
  assert.equal(run(['version']).status, 64);
  writeConf(conf, { KIT_DIR: join(dir, 'kit'), REGISTRY: 'ghcr.io/x;id' });
  assert.equal(run(['version']).status, 64);
  writeConf(conf, { KIT_DIR: join(dir, 'kit'), SERVER_ROOT: 'relative/path' });
  assert.equal(run(['version']).status, 64);
  for (const registry of ['ghcr.io/skycrew-app', 'skycrew-e2e', 'registry.example.fr:5000/skycrew']) {
    writeConf(conf, { KIT_DIR: join(dir, 'kit'), REGISTRY: registry });
    assert.equal(run(['version']).status, 0, registry);
  }
});
