import { MigrationInterface, QueryRunner } from 'typeorm';

// Flight plans of the new engine, the club's planning settings (one row,
// the AMC1 NCO.OP.125(b) defaults), and the engine that computed each
// flight's plan: the plans that exist already are marked "legacy" (shown
// as "ancien calcul", their figures are not recomputed).
export class AddFlightPlans1797000000003 implements MigrationInterface {
  name = 'AddFlightPlans1797000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "flight_planning_settings" (
         "id" integer NOT NULL,
         "reserve_vfr_day_local_min" integer NOT NULL DEFAULT 10,
         "reserve_vfr_day_min" integer NOT NULL DEFAULT 30,
         "reserve_vfr_night_min" integer NOT NULL DEFAULT 45,
         "contingency_percent" double precision NOT NULL DEFAULT 0,
         "contingency_min_l" double precision NOT NULL DEFAULT 0,
         "alternate_required_vfr" boolean NOT NULL DEFAULT false,
         "club_margin_min" integer NOT NULL DEFAULT 0,
         "vertical_margin_ft" integer NOT NULL DEFAULT 300,
         "default_circuit_height_ft" integer NOT NULL DEFAULT 1000,
         "default_descent_fpm" integer NOT NULL DEFAULT 500,
         "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         CONSTRAINT "PK_flight_planning_settings" PRIMARY KEY ("id")
       )`,
    );
    await queryRunner.query(
      `INSERT INTO "flight_planning_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "flight_plans" (
         "id" SERIAL NOT NULL,
         "flight_id" integer,
         "reservation_id" integer,
         "user_id" integer NOT NULL,
         "aircraft_id" integer,
         "input" jsonb NOT NULL,
         "result" jsonb NOT NULL,
         "engine_version" character varying(32) NOT NULL,
         "navdata_airac" character varying(16),
         "weather_fetched_at" TIMESTAMP WITH TIME ZONE,
         "status" character varying(16) NOT NULL,
         "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         CONSTRAINT "PK_flight_plans" PRIMARY KEY ("id"),
         CONSTRAINT "UQ_flight_plans_flight" UNIQUE ("flight_id"),
         CONSTRAINT "FK_flight_plans_flight" FOREIGN KEY ("flight_id")
           REFERENCES "flights"("id") ON DELETE CASCADE,
         CONSTRAINT "FK_flight_plans_reservation" FOREIGN KEY ("reservation_id")
           REFERENCES "reservations"("id") ON DELETE SET NULL,
         CONSTRAINT "FK_flight_plans_user" FOREIGN KEY ("user_id")
           REFERENCES "users"("id") ON DELETE CASCADE,
         CONSTRAINT "FK_flight_plans_aircraft" FOREIGN KEY ("aircraft_id")
           REFERENCES "aircraft"("id") ON DELETE SET NULL
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_flight_plans_user" ON "flight_plans" ("user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "flights" ADD COLUMN IF NOT EXISTS "plan_engine" character varying(32)`,
    );
    await queryRunner.query(
      `UPDATE "flights" SET "plan_engine" = 'legacy'
       WHERE "plan_engine" IS NULL AND "waypoints" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "flights" DROP COLUMN IF EXISTS "plan_engine"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "flight_plans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "flight_planning_settings"`);
  }
}
