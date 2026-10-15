import { loadConfig, type Config } from './config.ts';
import { openDb, type Db } from './db.ts';
import { recordAudit } from './audit.ts';
import { Fleet } from './fleet.ts';
import { Jobs } from './jobs.ts';
import { applyPaymentRule } from './stripe.ts';
import { buildApp } from './web/server.ts';

export interface Running {
  config: Config;
  db: Db;
  fleet: Fleet;
  jobs: Jobs;
  close: () => Promise<void>;
}

/** Starts the console: web pages on the loopback, background jobs, and the payment rule. */
export const serve = async (config: Config = loadConfig()): Promise<Running> => {
  const db = openDb(config.dbPath);
  const fleet = new Fleet(config);
  const jobs = new Jobs(db, config, fleet);
  const app = await buildApp({ config, db, fleet, jobs });
  jobs.start();
  const timers = [
    // The payment rule, every 10 minutes (also after each Stripe notification).
    setInterval(() => {
      try {
        applyPaymentRule(db, jobs, config.graceDays);
      } catch (error) {
        process.stderr.write(`payment rule: ${(error as Error).message}\n`);
      }
    }, 10 * 60_000),
    // The state of the clubs, kept fresh for the dashboard.
    setInterval(() => void fleet.all(true).catch(() => undefined), 5 * 60_000),
  ];
  await app.listen({ host: config.host, port: config.port });
  recordAudit(db, { actor: 'console', action: 'console.started', details: { servers: config.servers.map((s) => `${s.name}=${s.kind}`) } });
  process.stdout.write(`SkyCrew console on http://${config.host}:${config.port} (${config.publicUrl})\n`);
  return {
    config,
    db,
    fleet,
    jobs,
    close: async () => {
      timers.forEach(clearInterval);
      await app.close();
      await jobs.stop();
      db.close();
    },
  };
};
