import { MigrationInterface, QueryRunner } from 'typeorm';

// The showcase club (src/db/showcase) is brought up to date before each
// presentation ("showcase refresh"): the moment it was last brought up to
// date (created or refreshed) tells the next refresh where to start.
export class AddShowcaseRefreshDate1802000000002 implements MigrationInterface {
  name = 'AddShowcaseRefreshDate1802000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "showcase_state" ADD COLUMN IF NOT EXISTS "refreshed_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "showcase_state" DROP COLUMN IF EXISTS "refreshed_at"`,
    );
  }
}
