import { MigrationInterface, QueryRunner } from 'typeorm';

// Trace of what an administrator changes or deletes on a closed flight.
export class AddFlightAmendments1792100000002 implements MigrationInterface {
  name = 'AddFlightAmendments1792100000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "flight_amendments" (
        "id" SERIAL NOT NULL,
        "flight_id" integer NOT NULL,
        "action" character varying NOT NULL,
        "actor_id" integer,
        "before" jsonb NOT NULL,
        "after" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_flight_amendments" PRIMARY KEY ("id")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "flight_amendments"`);
  }
}
