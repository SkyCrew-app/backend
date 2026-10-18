import { MigrationInterface, QueryRunner } from 'typeorm';

// The connection log: who signed in to which account, when and from where.
// Lines are added, never changed, and removed only once older than the
// retention period. The interval below is LOGIN_EVENTS_RETENTION_MONTHS
// (src/common/login-events/login-events.ts): change both together.
// Every statement can run again on a database that already has them.
export const LOGIN_EVENTS_RETENTION_SQL = `interval '6 months'`;

export class AddLoginEvents1799000000001 implements MigrationInterface {
  name = 'AddLoginEvents1799000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "login_events" (
         "id" SERIAL NOT NULL,
         "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         "user_id" integer,
         "attempted_email" character varying(120),
         "outcome" character varying(40) NOT NULL,
         "method" character varying(30),
         "ip_address" character varying(45),
         "browser" character varying(60),
         "os" character varying(40),
         "device_type" character varying(20) NOT NULL DEFAULT 'unknown',
         "user_agent" character varying(300),
         CONSTRAINT "PK_login_events" PRIMARY KEY ("id")
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_login_events_created_at" ON "login_events" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_login_events_user_created" ON "login_events" ("user_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_login_events_outcome_created" ON "login_events" ("outcome", "created_at")`,
    );

    // Append-only in the database too, whatever the code does: no line is
    // ever changed, and the only deletion accepted is the retention purge,
    // whose rule lives here and not in a setting a session could switch on.
    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION "login_events_append_only"() RETURNS trigger AS $$
       BEGIN
         IF TG_OP = 'DELETE' AND OLD."created_at" < now() - ${LOGIN_EVENTS_RETENTION_SQL} THEN
           RETURN OLD;
         END IF;
         RAISE EXCEPTION 'login_events is append-only: lines are removed only once older than the retention period';
       END;
       $$ LANGUAGE plpgsql`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_login_events_append_only" ON "login_events"`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "TRG_login_events_append_only"
       BEFORE UPDATE OR DELETE ON "login_events"
       FOR EACH ROW EXECUTE FUNCTION "login_events_append_only"()`,
    );

    // The date of the last sign-in stays on the member once the log has
    // been purged.
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_sign_in_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "last_sign_in_at"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_login_events_append_only" ON "login_events"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "login_events_append_only"()`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "login_events"`);
  }
}
