import { MigrationInterface, QueryRunner } from 'typeorm';

// A flight is closed once its pilot has recorded what was flown.
export class AddFlightClosedAt1791710301630 implements MigrationInterface {
  name = 'AddFlightClosedAt1791710301630';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "flights" ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "flights" DROP COLUMN IF EXISTS "closed_at"`,
    );
  }
}
