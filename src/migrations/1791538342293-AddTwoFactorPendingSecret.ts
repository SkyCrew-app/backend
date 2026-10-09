import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTwoFactorPendingSecret1791538342293
  implements MigrationInterface
{
  name = 'AddTwoFactorPendingSecret1791538342293';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twoFactorAuthPendingSecret" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "twoFactorAuthPendingSecret"`,
    );
  }
}
