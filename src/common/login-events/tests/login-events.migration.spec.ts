import {
  AddLoginEvents1799000000001,
  LOGIN_EVENTS_RETENTION_SQL,
} from '../../../migrations/1799000000001-AddLoginEvents';
import { LOGIN_EVENTS_RETENTION_MONTHS } from '../login-events';

describe('connection log migration', () => {
  const statementsOf = async (direction: 'up' | 'down') => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    await new AddLoginEvents1799000000001()[direction](queryRunner as any);
    return queryRunner.query.mock.calls.map(([sql]) =>
      String(sql).replace(/\s+/g, ' ').trim(),
    );
  };

  it('can run again on a database that already has it', async () => {
    for (const statement of await statementsOf('up')) {
      expect(statement).toMatch(
        /^(CREATE TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS|CREATE OR REPLACE FUNCTION|DROP TRIGGER IF EXISTS|CREATE TRIGGER|ALTER TABLE "users" ADD COLUMN IF NOT EXISTS)/,
      );
    }
    // The trigger is dropped just before it is created again.
    const statements = await statementsOf('up');
    const create = statements.findIndex((s) => s.startsWith('CREATE TRIGGER'));
    expect(statements[create - 1]).toMatch(/^DROP TRIGGER IF EXISTS/);
  });

  it('refuses in the database any change, and any deletion before the retention period', async () => {
    const statements = await statementsOf('up');
    const fn = statements.find((s) =>
      s.startsWith('CREATE OR REPLACE FUNCTION "login_events_append_only"'),
    );
    // A deletion goes through only for a line older than the retention;
    // everything else (an UPDATE, a younger line) raises.
    expect(fn).toContain(
      `IF TG_OP = 'DELETE' AND OLD."created_at" < now() - interval '6 months' THEN RETURN OLD;`,
    );
    expect(fn).toContain('RAISE EXCEPTION');
    expect(fn).not.toMatch(/current_setting|set_config/);
    expect(statements).toContain(
      'CREATE TRIGGER "TRG_login_events_append_only" BEFORE UPDATE OR DELETE ON "login_events" FOR EACH ROW EXECUTE FUNCTION "login_events_append_only"()',
    );
  });

  it('states the same retention as the code', () => {
    expect(LOGIN_EVENTS_RETENTION_SQL).toBe(
      `interval '${LOGIN_EVENTS_RETENTION_MONTHS} months'`,
    );
  });

  it('stores no column for a secret', async () => {
    const table = (await statementsOf('up')).find((s) =>
      s.startsWith('CREATE TABLE IF NOT EXISTS "login_events"'),
    );
    expect(table).not.toMatch(/password|token|code|secret/i);
  });

  it('undoes itself', async () => {
    expect(await statementsOf('down')).toEqual([
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "last_sign_in_at"',
      'DROP TRIGGER IF EXISTS "TRG_login_events_append_only" ON "login_events"',
      'DROP FUNCTION IF EXISTS "login_events_append_only"()',
      'DROP TABLE IF EXISTS "login_events"',
    ]);
  });
});
