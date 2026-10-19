import { MigrationInterface, QueryRunner } from 'typeorm';

// Navigation data completed for the flight preparation: the obstacles of
// each cycle (SIA ObstacleS) and the published hours of an airspace kept
// apart from its activity. Every statement can run again on a database
// that already has them; the data comes with the next bundle import.
export class AddObstaclesAndAirspaceHours1800000000001
  implements MigrationInterface
{
  name = 'AddObstaclesAndAirspaceHours1800000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "airspaces" ADD COLUMN IF NOT EXISTS "hours" text`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "obstacles" (
         "id" SERIAL NOT NULL,
         "cycle_id" integer NOT NULL,
         "ident" character varying(32) NOT NULL,
         "type" character varying(48) NOT NULL,
         "lat" double precision NOT NULL,
         "lon" double precision NOT NULL,
         "amsl_ft" integer NOT NULL,
         "agl_ft" integer,
         "count" integer NOT NULL DEFAULT 1,
         "lighting" character varying(32),
         "remark" text,
         CONSTRAINT "PK_obstacles" PRIMARY KEY ("id"),
         CONSTRAINT "FK_obstacles_cycle" FOREIGN KEY ("cycle_id")
           REFERENCES "navdata_cycles"("id") ON DELETE CASCADE
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_obstacles_cycle_lat_lon" ON "obstacles" ("cycle_id", "lat", "lon")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "obstacles"`);
    await queryRunner.query(
      `ALTER TABLE "airspaces" DROP COLUMN IF EXISTS "hours"`,
    );
  }
}
