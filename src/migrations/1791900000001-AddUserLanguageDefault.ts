import { MigrationInterface, QueryRunner } from 'typeorm';

// The language a member is written to (e-mails, notifications) is always
// known: 'fr' or 'en', French unless chosen otherwise. The column existed as
// a free, optional text.
export class AddUserLanguageDefault1791900000001 implements MigrationInterface {
  name = 'AddUserLanguageDefault1791900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "language" character varying`,
    );
    await queryRunner.query(
      `UPDATE "users"
       SET "language" = CASE
         WHEN lower(left(trim("language"), 2)) = 'en' THEN 'en'
         ELSE 'fr'
       END
       WHERE "language" IS NULL OR "language" NOT IN ('fr', 'en')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "language" SET DEFAULT 'fr'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "language" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "language" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "language" DROP DEFAULT`,
    );
  }
}
