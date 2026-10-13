import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';

// Invoices get a number: sequential within a year, without gaps. The
// invoices that already exist are numbered in the order they were issued.
export class AddInvoiceNumbers1793100000004 implements MigrationInterface {
  name = 'AddInvoiceNumbers1793100000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "invoice_sequences" (
         "year" integer NOT NULL,
         "last_number" integer NOT NULL DEFAULT 0,
         CONSTRAINT "PK_invoice_sequences" PRIMARY KEY ("year")
       )`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoice_number" character varying(20)`,
    );

    // Existing invoices without a number continue each year's sequence, in
    // the order of their date. Running this again numbers nothing twice.
    await queryRunner.query(
      `WITH numbered AS (
         SELECT i."id",
                EXTRACT(YEAR FROM i."invoice_date")::int AS year,
                ROW_NUMBER() OVER (
                  PARTITION BY EXTRACT(YEAR FROM i."invoice_date")
                  ORDER BY i."invoice_date", i."id"
                ) AS position
         FROM "invoices" i
         WHERE i."invoice_number" IS NULL
       )
       UPDATE "invoices" AS target
       SET "invoice_number" = numbered.year::text || '-' ||
           lpad((COALESCE(sequence."last_number", 0) + numbered.position)::text, 5, '0')
       FROM numbered
       LEFT JOIN "invoice_sequences" sequence ON sequence."year" = numbered.year
       WHERE target."id" = numbered."id"`,
    );
    // Each year's counter is the highest number it holds.
    await queryRunner.query(
      `INSERT INTO "invoice_sequences" ("year", "last_number")
       SELECT split_part("invoice_number", '-', 1)::int,
              max(split_part("invoice_number", '-', 2)::int)
       FROM "invoices"
       WHERE "invoice_number" ~ '^[0-9]{4}-[0-9]+$'
       GROUP BY 1
       ON CONFLICT ("year") DO UPDATE
       SET "last_number" = GREATEST("invoice_sequences"."last_number", EXCLUDED."last_number")`,
    );

    const duplicates: { invoice_number: string }[] = await queryRunner.query(
      `SELECT "invoice_number" FROM "invoices"
       WHERE "invoice_number" IS NOT NULL
       GROUP BY "invoice_number" HAVING count(*) > 1`,
    );
    if (duplicates.length > 0) {
      new Logger('Migration').warn(
        `Unique invoice number index not created: ${duplicates.length} number(s) are used twice (${duplicates
          .map((duplicate) => duplicate.invoice_number)
          .join(
            ', ',
          )}). Fix them, then create "UQ_invoices_invoice_number" by hand.`,
      );
      return;
    }
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_invoices_invoice_number" ON "invoices" ("invoice_number") WHERE "invoice_number" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_invoices_invoice_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP COLUMN IF EXISTS "invoice_number"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_sequences"`);
  }
}
