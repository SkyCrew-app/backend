import { MigrationInterface, QueryRunner } from 'typeorm';

// Take-off and landing distances in the flight plans: the tables of the
// flight manual of each aircraft (null until entered) and the club's
// safety factors (UK CAA Safety Sense Leaflet 7: 1.33 and 1.43). Every
// statement can run again on a database that already has them.
export class AddRunwayDistances1801000000002 implements MigrationInterface {
  name = 'AddRunwayDistances1801000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "aircraft_performance" ADD COLUMN IF NOT EXISTS "takeoff" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "aircraft_performance" ADD COLUMN IF NOT EXISTS "landing" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "flight_planning_settings" ADD COLUMN IF NOT EXISTS "takeoff_safety_factor" double precision NOT NULL DEFAULT 1.33`,
    );
    await queryRunner.query(
      `ALTER TABLE "flight_planning_settings" ADD COLUMN IF NOT EXISTS "landing_safety_factor" double precision NOT NULL DEFAULT 1.43`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "flight_planning_settings" DROP COLUMN IF EXISTS "landing_safety_factor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flight_planning_settings" DROP COLUMN IF EXISTS "takeoff_safety_factor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "aircraft_performance" DROP COLUMN IF EXISTS "landing"`,
    );
    await queryRunner.query(
      `ALTER TABLE "aircraft_performance" DROP COLUMN IF EXISTS "takeoff"`,
    );
  }
}
