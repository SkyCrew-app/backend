import { MigrationInterface, QueryRunner } from 'typeorm';

// The trace of what administrators do: lines are added, never changed.
export class AddAdminActions1793100000001 implements MigrationInterface {
  name = 'AddAdminActions1793100000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "admin_actions" (
         "id" SERIAL NOT NULL,
         "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         "actor_id" integer,
         "actor_label" character varying(255),
         "action" character varying(60) NOT NULL,
         "target_type" character varying(40) NOT NULL,
         "target_id" character varying(100),
         "target_label" character varying(255),
         "summary" jsonb,
         CONSTRAINT "PK_admin_actions" PRIMARY KEY ("id")
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_actions_created_at" ON "admin_actions" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_actions_actor" ON "admin_actions" ("actor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_actions_target" ON "admin_actions" ("target_type", "target_id")`,
    );

    // Append-only in the database too, whatever the code does.
    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION "admin_actions_append_only"() RETURNS trigger AS $$
       BEGIN
         RAISE EXCEPTION 'admin_actions is append-only';
       END;
       $$ LANGUAGE plpgsql`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_admin_actions_append_only" ON "admin_actions"`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "TRG_admin_actions_append_only"
       BEFORE UPDATE OR DELETE ON "admin_actions"
       FOR EACH ROW EXECUTE FUNCTION "admin_actions_append_only"()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_admin_actions_append_only" ON "admin_actions"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "admin_actions_append_only"()`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_actions"`);
  }
}
