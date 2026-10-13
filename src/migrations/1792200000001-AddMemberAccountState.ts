import { MigrationInterface, QueryRunner } from 'typeorm';

// A member who leaves is deactivated instead of deleted, and an invitation
// link no longer works for ever.
export class AddMemberAccountState1792200000001 implements MigrationInterface {
  name = 'AddMemberAccountState1792200000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "validationTokenExpiresAt" TIMESTAMP WITH TIME ZONE`,
    );
    // Invitations already sent keep working for a week from now.
    await queryRunner.query(
      `UPDATE "users"
       SET "validationTokenExpiresAt" = now() + interval '7 days'
       WHERE "validation_token" IS NOT NULL
         AND "validationTokenExpiresAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "validationTokenExpiresAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "is_active"`,
    );
  }
}
