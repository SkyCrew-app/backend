import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';

// Navigation data per AIRAC cycle: the cycles, the points (aerodromes,
// navaids, VFR reporting points) and the airspaces. Created only if
// missing; the optional trigram index (pg_trgm) is skipped with a warning
// where the extension cannot be installed.
export class AddNavdata1797000000001 implements MigrationInterface {
  name = 'AddNavdata1797000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "navdata_cycles" (
         "id" SERIAL NOT NULL,
         "airac" character varying(16) NOT NULL,
         "effective_from" TIMESTAMP WITH TIME ZONE NOT NULL,
         "effective_to" TIMESTAMP WITH TIME ZONE NOT NULL,
         "source" text NOT NULL,
         "status" character varying(16) NOT NULL,
         "has_sia" boolean NOT NULL DEFAULT false,
         "sha256" character varying(64),
         "report" jsonb,
         "imported_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         CONSTRAINT "PK_navdata_cycles" PRIMARY KEY ("id")
       )`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "nav_points" (
         "id" uuid NOT NULL DEFAULT gen_random_uuid(),
         "cycle_id" integer,
         "type" character varying(16) NOT NULL,
         "ident" character varying(32) NOT NULL,
         "name" text,
         "lat" double precision NOT NULL,
         "lon" double precision NOT NULL,
         "elevation_ft" integer,
         "frequency" character varying(16),
         "country" character varying(2),
         "aerodrome_icao" character varying(8),
         "vrp_mandatory" boolean,
         "source" character varying(16) NOT NULL,
         "source_id" character varying(64),
         "extra" jsonb,
         CONSTRAINT "PK_nav_points" PRIMARY KEY ("id"),
         CONSTRAINT "FK_nav_points_cycle" FOREIGN KEY ("cycle_id")
           REFERENCES "navdata_cycles"("id") ON DELETE CASCADE
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_nav_points_cycle_ident" ON "nav_points" ("cycle_id", "ident")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_nav_points_cycle_lat_lon" ON "nav_points" ("cycle_id", "lat", "lon")`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "airspaces" (
         "id" uuid NOT NULL DEFAULT gen_random_uuid(),
         "cycle_id" integer NOT NULL,
         "source_id" character varying(96) NOT NULL,
         "name" text NOT NULL,
         "type" character varying(16) NOT NULL,
         "icao_class" character varying(1),
         "floor_ref" character varying(4) NOT NULL,
         "floor_value" integer NOT NULL,
         "ceiling_ref" character varying(4) NOT NULL,
         "ceiling_value" integer NOT NULL,
         "geometry" jsonb NOT NULL,
         "min_lat" double precision NOT NULL,
         "max_lat" double precision NOT NULL,
         "min_lon" double precision NOT NULL,
         "max_lon" double precision NOT NULL,
         "activity" text,
         "schedule_code" character varying(16),
         "frequencies" jsonb NOT NULL DEFAULT '[]',
         "remarks" text,
         CONSTRAINT "PK_airspaces" PRIMARY KEY ("id"),
         CONSTRAINT "FK_airspaces_cycle" FOREIGN KEY ("cycle_id")
           REFERENCES "navdata_cycles"("id") ON DELETE CASCADE
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_airspaces_cycle_box" ON "airspaces" ("cycle_id", "min_lat", "max_lat", "min_lon", "max_lon")`,
    );

    // Faster name search; optional (needs the right to create extensions).
    await queryRunner.query(`SAVEPOINT "nav_points_trgm"`);
    try {
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_nav_points_name_trgm" ON "nav_points" USING gin ("name" gin_trgm_ops)`,
      );
      await queryRunner.query(`RELEASE SAVEPOINT "nav_points_trgm"`);
    } catch (error) {
      await queryRunner.query(`ROLLBACK TO SAVEPOINT "nav_points_trgm"`);
      new Logger('Migration').warn(
        `Trigram index on nav_points.name not created: ${(error as Error)?.message}`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_nav_points_name_trgm"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "airspaces"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "nav_points"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "navdata_cycles"`);
  }
}
