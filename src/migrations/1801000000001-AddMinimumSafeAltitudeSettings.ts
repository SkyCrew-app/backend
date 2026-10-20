import { MigrationInterface, QueryRunner } from 'typeorm';

// The club's minimum safe altitude rule for the flight plans: the corridor
// either side of the track and the margin above the highest terrain or
// obstacle in it. Every statement can run again on a database that
// already has them.
export class AddMinimumSafeAltitudeSettings1801000000001
  implements MigrationInterface
{
  name = 'AddMinimumSafeAltitudeSettings1801000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "flight_planning_settings" ADD COLUMN IF NOT EXISTS "msa_corridor_nm" double precision NOT NULL DEFAULT 5`,
    );
    await queryRunner.query(
      `ALTER TABLE "flight_planning_settings" ADD COLUMN IF NOT EXISTS "msa_margin_ft" integer NOT NULL DEFAULT 1000`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "flight_planning_settings" DROP COLUMN IF EXISTS "msa_margin_ft"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flight_planning_settings" DROP COLUMN IF EXISTS "msa_corridor_nm"`,
    );
  }
}
