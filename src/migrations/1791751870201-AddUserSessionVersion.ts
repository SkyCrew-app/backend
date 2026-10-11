import { MigrationInterface, QueryRunner } from 'typeorm';

// Sessions carry the version they were opened with: raising it on a user
// ends every session of that user.
export class AddUserSessionVersion1791751870201 implements MigrationInterface {
  name = 'AddUserSessionVersion1791751870201';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sessionVersion" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "sessionVersion"`,
    );
  }
}
