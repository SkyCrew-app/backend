import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';

// One licence number per licence type, the reminders already sent for a
// licence, and a validity flag that agrees with the status.
export class LicenceNumberUniqueAndReminders1793100000003
  implements MigrationInterface
{
  name = 'LicenceNumberUniqueAndReminders1793100000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "expiry_reminder_days" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "expiry_reminder_for" TIMESTAMP`,
    );

    // Only "active" is valid, and the two columns used to drift apart.
    // Where they disagree the stricter reading wins: nothing becomes usable
    // because of this migration.
    await queryRunner.query(
      `UPDATE "licenses" SET "status" = 'pending'
       WHERE "is_valid" = false AND "status" = 'active'`,
    );
    await queryRunner.query(
      `UPDATE "licenses" SET "is_valid" = false
       WHERE "is_valid" = true AND "status" <> 'active'`,
    );

    const collisions: { license_type: string; number: string; ids: string }[] =
      await queryRunner.query(
        `SELECT "license_type", upper(btrim("license_number")) AS number,
                string_agg("id"::text, ', ' ORDER BY "id") AS ids
         FROM "licenses"
         WHERE "license_number" IS NOT NULL AND btrim("license_number") <> ''
         GROUP BY "license_type", upper(btrim("license_number"))
         HAVING count(*) > 1`,
      );

    if (collisions.length > 0) {
      // The application still starts, and still refuses new duplicates in
      // its own check; an administrator settles the existing ones.
      new Logger('Migration').warn(
        `Unique licence number index not created: ${collisions.length} number(s) are carried by several licences of the same type (${collisions
          .map(
            (collision) =>
              `${collision.license_type} ${collision.number}: licence ids [${collision.ids}]`,
          )
          .join(
            '; ',
          )}). Fix them, then create "UQ_licenses_type_number" by hand.`,
      );
      return;
    }

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_licenses_type_number"
       ON "licenses" ("license_type", upper(btrim("license_number")))
       WHERE "license_number" IS NOT NULL AND btrim("license_number") <> ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_licenses_type_number"`);
    await queryRunner.query(
      `ALTER TABLE "licenses" DROP COLUMN IF EXISTS "expiry_reminder_for"`,
    );
    await queryRunner.query(
      `ALTER TABLE "licenses" DROP COLUMN IF EXISTS "expiry_reminder_days"`,
    );
  }
}
