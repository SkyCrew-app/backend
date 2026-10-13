import { MigrationInterface, QueryRunner } from 'typeorm';

// Follow-up of an incident: the note written when it is resolved, when it
// was resolved and by whom.
export class AddIncidentResolution1791890000000 implements MigrationInterface {
  name = 'AddIncidentResolution1791890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "resolution_note" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "resolvedById" integer`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_3f5b4975f2c8a9986786ed49e4f'
        ) THEN
          ALTER TABLE "incidents" ADD CONSTRAINT "FK_3f5b4975f2c8a9986786ed49e4f" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "incidents" DROP CONSTRAINT IF EXISTS "FK_3f5b4975f2c8a9986786ed49e4f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" DROP COLUMN IF EXISTS "resolvedById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" DROP COLUMN IF EXISTS "resolved_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" DROP COLUMN IF EXISTS "resolution_note"`,
    );
  }
}
