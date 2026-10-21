import { MigrationInterface, QueryRunner } from 'typeorm';

// The showcase club (src/db/showcase): every row the generator writes is
// listed in "showcase_items", so that removing the showcase deletes exactly
// those rows. "showcase_state" holds the one showcase that may exist and the
// counter of its own invoice series (the club's numbering is never used).
export class AddShowcaseTracking1797100000001 implements MigrationInterface {
  name = 'AddShowcaseTracking1797100000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "showcase_items" (
         "entity" character varying(63) NOT NULL,
         "row_id" character varying(64) NOT NULL,
         CONSTRAINT "PK_showcase_items" PRIMARY KEY ("entity", "row_id")
       )`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "showcase_state" (
         "id" integer NOT NULL,
         "seed" integer NOT NULL,
         "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         "invoice_prefix" character varying(8) NOT NULL,
         "invoice_last_number" integer NOT NULL DEFAULT 0,
         "summary" jsonb,
         CONSTRAINT "PK_showcase_state" PRIMARY KEY ("id")
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "showcase_state"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "showcase_items"`);
  }
}
