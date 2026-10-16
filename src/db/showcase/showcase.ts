import 'dotenv/config';
import { join } from 'path';
import { randomInt } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { Administration } from '../../modules/administration/entity/admin.entity';
import {
  parsePlanConfig,
  PLAN_FEATURES,
  PlanFeature,
} from '../../common/plan/plan';
import { buildShowcase, planProblems, ShowcasePlan } from './build';
import { writeShowcase } from './writer';
import { removeShowcase } from './removal';
import { SHOWCASE_INVOICE_PREFIX } from './ledger';
import { SHOWCASE_EMAIL_DOMAIN } from './content';
import { SHOWCASE_REGISTRATIONS } from './fleet';
import { ShowcaseState } from './showcase.entity';

// The showcase club: a fictitious, busy club written into a real
// installation for a demonstration, and removed afterwards.
//
//   node dist/src/db/showcase/showcase.js create [--seed <n>]
//   node dist/src/db/showcase/showcase.js remove [--dry-run] [--with-dependents]
//
// It talks to the database only (DATABASE_URL): no e-mail, no scheduler, no
// call to the application's services.

export const USAGE = `Showcase club for a demonstration (fictitious members, aircraft and activity).

Usage:
  showcase create [--seed <n>]
      Writes the club: about 60 members, 6 aircraft, six months of history
      and three weeks of bookings, relative to now. Refused when a showcase
      already exists. Prints the presentation accounts and their passwords
      once: they are stored nowhere else.
  showcase remove [--dry-run] [--with-dependents]
      Deletes every row the showcase wrote, and nothing else. Refused when
      rows written since point at the showcase (a booking made during the
      demonstration...): --dry-run lists them, --with-dependents removes
      them too.
  showcase --help

Environment: DATABASE_URL (the application's database). Run "create" once the
application has started at least once (it applies the migrations and imports
the aerodromes).`;

export interface Arguments {
  command: 'create' | 'remove' | 'help';
  seed: number | null;
  dryRun: boolean;
  withDependents: boolean;
}

export const parseArguments = (argv: string[]): Arguments => {
  const args = [...argv];
  const has = (flag: string) => args.includes(flag);
  const command =
    has('--help') || has('-h') ? 'help' : args.find((a) => !a.startsWith('-'));
  if (command !== 'create' && command !== 'remove' && command !== 'help') {
    throw new Error(`Unknown or missing command.\n\n${USAGE}`);
  }
  let seed: number | null = null;
  const seedAt = args.indexOf('--seed');
  if (seedAt >= 0) {
    seed = Number(args[seedAt + 1]);
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
      throw new Error('--seed takes a whole number between 0 and 4294967295');
    }
  }
  const known = [
    'create',
    'remove',
    'help',
    '--help',
    '-h',
    '--seed',
    '--dry-run',
    '--with-dependents',
  ];
  const unknown = args.filter(
    (a, i) => !known.includes(a) && !(seedAt >= 0 && i === seedAt + 1),
  );
  if (unknown.length > 0) {
    throw new Error(`Unknown option ${unknown.join(' ')}.\n\n${USAGE}`);
  }
  return {
    command,
    seed,
    dryRun: has('--dry-run'),
    withDependents: has('--with-dependents'),
  };
};

const dataSource = () =>
  new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [join(__dirname, '../../**/*.entity{.ts,.js}')],
    synchronize: false,
    migrationsRun: false,
    logging: false,
  });

const assertTrackingTables = async (manager: EntityManager) => {
  const [row] = await manager.query(
    `SELECT to_regclass('showcase_items') IS NOT NULL AND to_regclass('showcase_state') IS NOT NULL AS ready`,
  );
  if (!row?.ready) {
    throw new Error(
      'The showcase tables do not exist yet: start the application once (it applies its migrations), then try again.',
    );
  }
};

const existingShowcase = async (manager: EntityManager): Promise<boolean> => {
  const [row] = await manager.query(
    `SELECT (SELECT count(*) FROM "showcase_state") + (SELECT count(*) FROM "showcase_items") AS n`,
  );
  return Number(row.n) > 0;
};

const summaryOf = (plan: ShowcasePlan) => ({
  members: plan.members.length,
  aircraft: plan.fleet.length,
  bookings: plan.bookings.filter((b) => !b.cancelledAt).length,
  cancelledBookings: plan.bookings.filter((b) => b.cancelledAt).length,
  upcomingBookings: plan.bookings.filter(
    (b) => !b.cancelledAt && b.start > plan.now,
  ).length,
  flights: plan.bookings.filter((b) => b.flight).length,
  flightHours:
    Math.round(
      plan.bookings.reduce(
        (s, b) => s + (b.flight?.closedAt ? b.flight.hours : 0),
        0,
      ) * 10,
    ) / 10,
  courses: plan.courses.length,
  payments: plan.payments.length,
  invoices: plan.invoices.length,
  incidents: plan.incidents.length,
  maintenances: plan.maintenances.length,
  historyFrom: plan.historyStart.toISOString(),
});

export const createCommand = async (
  source: DataSource,
  seedArgument: number | null,
  now: Date = new Date(),
  log: (line: string) => void = console.log,
) => {
  const seed = seedArgument ?? randomInt(0, 2 ** 31);
  const manager = source.manager;
  await assertTrackingTables(manager);
  if (await existingShowcase(manager)) {
    throw new Error(
      'A showcase already exists: remove it first ("showcase remove").',
    );
  }
  const settings = await manager
    .getRepository(Administration)
    .createQueryBuilder('a')
    .orderBy('a.id', 'ASC')
    .getOne();
  if (!settings) {
    throw new Error(
      'The club settings are missing: start the application once, then try again.',
    );
  }
  const [{ emails }] = await manager.query(
    `SELECT count(*)::int AS emails FROM "users" WHERE lower("email") LIKE $1`,
    [`%@${SHOWCASE_EMAIL_DOMAIN}`],
  );
  const [{ aircraft }] = await manager.query(
    `SELECT count(*)::int AS aircraft FROM "aircraft" WHERE "registration_number" = ANY($1::text[])`,
    [[...SHOWCASE_REGISTRATIONS]],
  );
  if (emails > 0 || aircraft > 0) {
    throw new Error(
      `Members at @${SHOWCASE_EMAIL_DOMAIN} or aircraft ${SHOWCASE_REGISTRATIONS.join(', ')} exist already, outside any showcase: nothing was written.`,
    );
  }

  const { config } = parsePlanConfig(process.env);
  const instruction = PLAN_FEATURES[config.plan].includes(
    PlanFeature.INSTRUCTION,
  );
  const plan = buildShowcase({ now, seed, settings, instruction });
  const [{ users, fleet }] = await manager.query(
    `SELECT (SELECT count(*)::int FROM "users") AS users, (SELECT count(*)::int FROM "aircraft") AS fleet`,
  );
  if (
    config.maxMembers != null &&
    users + plan.members.length > config.maxMembers
  ) {
    throw new Error(
      `The plan allows ${config.maxMembers} members: the showcase needs ${plan.members.length} more.`,
    );
  }
  if (
    config.maxAircraft != null &&
    fleet + plan.fleet.length > config.maxAircraft
  ) {
    throw new Error(
      `The plan allows ${config.maxAircraft} aircraft: the showcase needs ${plan.fleet.length} more.`,
    );
  }
  const problems = planProblems(plan);
  if (problems.length > 0) {
    throw new Error(
      `The planned showcase breaks a rule, nothing was written:\n  ${problems.join('\n  ')}`,
    );
  }

  const outcome = await source.transaction(async (tx) => {
    await tx.query(`LOCK TABLE "showcase_state" IN EXCLUSIVE MODE`);
    if (await existingShowcase(tx)) {
      throw new Error(
        'A showcase already exists: remove it first ("showcase remove").',
      );
    }
    const written = await writeShowcase(tx, plan);
    await tx.getRepository(ShowcaseState).insert({
      id: 1,
      seed,
      invoice_prefix: SHOWCASE_INVOICE_PREFIX,
      invoice_last_number: plan.invoiceLastNumber,
      summary: { ...summaryOf(plan), rows: written.counts },
    });
    return written;
  });

  const summary = summaryOf(plan);
  log(
    `Showcase club created (seed ${seed}, history from ${summary.historyFrom.slice(0, 10)}).`,
  );
  log(
    `  ${summary.members} members, ${summary.aircraft} aircraft, ${summary.bookings} bookings (${summary.upcomingBookings} upcoming, ${summary.cancelledBookings} cancelled), ${summary.flights} flights (${summary.flightHours} h closed), ${summary.courses} courses, ${summary.payments} account lines, ${summary.invoices} invoices (${SHOWCASE_INVOICE_PREFIX}- series).`,
  );
  log(
    `  ${Object.values(outcome.counts).reduce((a, b) => a + b, 0)} rows written and recorded for removal.`,
  );
  for (const warning of outcome.warnings) log(`  Warning: ${warning}`);
  log('');
  log('Presentation accounts — shown once, stored nowhere else:');
  for (const c of outcome.credentials) {
    log(
      `  ${c.role.padEnd(11)} ${c.name.padEnd(24)} ${c.email}  ${c.password}`,
    );
  }
  return { seed, plan, outcome };
};

export const removeCommand = async (
  source: DataSource,
  options: { dryRun: boolean; withDependents: boolean },
  log: (line: string) => void = console.log,
) => {
  await assertTrackingTables(source.manager);
  if (!(await existingShowcase(source.manager))) {
    log('No showcase to remove.');
    return null;
  }
  const report = await source.transaction((tx) => removeShowcase(tx, options));
  const total = Object.values(report.deleted).reduce((a, b) => a + b, 0);
  for (const d of report.dependents) {
    log(
      `  ${report.dryRun ? 'Would also' : 'Also'} ${d.onDelete === 'n' ? 'detach' : 'remove'}: ${d.table} (${d.via}) ${d.ids.length} row(s) written after the showcase`,
    );
  }
  log(
    `${report.dryRun ? 'Dry run — would remove' : 'Showcase removed —'} ${total} rows:\n  ${Object.entries(
      report.deleted,
    )
      .sort()
      .map(([table, n]) => `${table}: ${n}`)
      .join('\n  ')}`,
  );
  return report;
};

const main = async () => {
  let args: Arguments;
  try {
    args = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error((error as Error).message);
    process.exit(2);
  }
  if (args.command === 'help') {
    console.log(USAGE);
    return;
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(2);
  }
  const source = await dataSource().initialize();
  try {
    if (args.command === 'create') {
      await createCommand(source, args.seed);
    } else {
      await removeCommand(source, args);
    }
  } catch (error) {
    console.error(
      `Showcase ${args.command} failed: ${(error as Error).message}`,
    );
    process.exitCode = 1;
  } finally {
    await source.destroy();
  }
};

if (require.main === module) {
  void main();
}
