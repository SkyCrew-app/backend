import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';

// E-mail addresses identify a member whatever their case: they are stored in
// lower case and unique in that form.
export class CaseInsensitiveUserEmail1792200000002
  implements MigrationInterface
{
  name = 'CaseInsensitiveUserEmail1792200000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rewritten only where the lower-case form belongs to nobody else.
    await queryRunner.query(
      `UPDATE "users" AS u
       SET "email" = lower(trim(u."email"))
       WHERE u."email" <> lower(trim(u."email"))
         AND NOT EXISTS (
           SELECT 1 FROM "users" AS o
           WHERE o."id" <> u."id"
             AND lower(trim(o."email")) = lower(trim(u."email"))
         )`,
    );

    const collisions: { ids: string }[] = await queryRunner.query(
      `SELECT string_agg("id"::text, ', ' ORDER BY "id") AS ids
       FROM "users"
       GROUP BY lower("email")
       HAVING count(*) > 1`,
    );

    if (collisions.length > 0) {
      // Two accounts already share an address: the application still starts,
      // and an administrator has to settle which one stays.
      new Logger('Migration').warn(
        `Unique e-mail index not created: ${collisions.length} address(es) are used by several accounts differing only by case (user ids: ${collisions
          .map((collision) => `[${collision.ids}]`)
          .join(' ')}). Fix them, then create "UQ_users_email_lower" by hand.`,
      );
      return;
    }

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email_lower" ON "users" (lower("email"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_email_lower"`);
  }
}
