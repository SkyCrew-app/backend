import { MigrationInterface, QueryRunner } from 'typeorm';

// A password reset link carries a one-time token: only its hash and its
// expiry are stored.
export class AddPasswordReset1791710672199 implements MigrationInterface {
  name = 'AddPasswordReset1791710672199';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordResetExpiresAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordResetTokenHash"`,
    );
  }
}
