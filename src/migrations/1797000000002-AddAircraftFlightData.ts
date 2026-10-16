import { MigrationInterface, QueryRunner } from 'typeorm';

// Performance and mass & balance of each aircraft. Every existing aircraft
// gets an empty, unconfirmed record carrying what the fleet sheet knew
// (usable fuel = fuel capacity, empty mass, MTOW): an administrator fills
// in the flight manual data and confirms it before it is used.
export class AddAircraftFlightData1797000000002 implements MigrationInterface {
  name = 'AddAircraftFlightData1797000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "aircraft_performance" (
         "aircraft_id" integer NOT NULL,
         "template_code" character varying(32),
         "fuel" jsonb NOT NULL,
         "climb" jsonb NOT NULL,
         "cruise" jsonb NOT NULL,
         "descent" jsonb NOT NULL,
         "reserve" jsonb NOT NULL,
         "arrival_fuel_l" double precision NOT NULL DEFAULT 0,
         "calibration" jsonb NOT NULL DEFAULT '[]',
         "service_ceiling_ft" integer,
         "source" text,
         "validated_by_id" integer,
         "validated_at" TIMESTAMP WITH TIME ZONE,
         "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         CONSTRAINT "PK_aircraft_performance" PRIMARY KEY ("aircraft_id"),
         CONSTRAINT "FK_aircraft_performance_aircraft" FOREIGN KEY ("aircraft_id")
           REFERENCES "aircraft"("id") ON DELETE CASCADE,
         CONSTRAINT "FK_aircraft_performance_validated_by" FOREIGN KEY ("validated_by_id")
           REFERENCES "users"("id") ON DELETE SET NULL
       )`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "aircraft_mass_balance" (
         "aircraft_id" integer NOT NULL,
         "empty_mass_kg" double precision,
         "empty_arm_m" double precision,
         "weighing_date" TIMESTAMP WITH TIME ZONE,
         "weighing_ref" text,
         "mtow_kg" double precision,
         "mlw_kg" double precision,
         "mzfw_kg" double precision,
         "stations" jsonb NOT NULL DEFAULT '[]',
         "combined_limits" jsonb NOT NULL DEFAULT '[]',
         "envelopes" jsonb NOT NULL DEFAULT '[]',
         "validated_by_id" integer,
         "validated_at" TIMESTAMP WITH TIME ZONE,
         "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         CONSTRAINT "PK_aircraft_mass_balance" PRIMARY KEY ("aircraft_id"),
         CONSTRAINT "FK_aircraft_mass_balance_aircraft" FOREIGN KEY ("aircraft_id")
           REFERENCES "aircraft"("id") ON DELETE CASCADE,
         CONSTRAINT "FK_aircraft_mass_balance_validated_by" FOREIGN KEY ("validated_by_id")
           REFERENCES "users"("id") ON DELETE SET NULL
       )`,
    );

    await queryRunner.query(
      `INSERT INTO "aircraft_performance" ("aircraft_id", "fuel", "climb", "cruise", "descent", "reserve", "source")
       SELECT a."id",
              jsonb_build_object(
                'type', CASE WHEN upper(coalesce(a."fuel_type", '')) ~ 'JET|A-?1|DIESEL' THEN 'JET_A1'
                             WHEN upper(coalesce(a."fuel_type", '')) ~ 'UL ?91' THEN 'UL91'
                             ELSE 'AVGAS_100LL' END,
                'densityKgPerL', CASE WHEN upper(coalesce(a."fuel_type", '')) ~ 'JET|A-?1|DIESEL' THEN 0.8 ELSE 0.72 END,
                'tanks', CASE WHEN a."fuel_capacity" IS NULL THEN '[]'::jsonb
                              ELSE jsonb_build_array(jsonb_build_object(
                                'id', 'main', 'label', 'Réservoir / Tank',
                                'usableL', a."fuel_capacity", 'unusableL', 0, 'armM', 0)) END,
                'taxiFuelL', 3,
                'burnOrder', '[]'::jsonb),
              '{"iasKt": 0, "table": null}'::jsonb,
              '{"normalSetting": "", "rows": []}'::jsonb,
              '{"iasKt": 0, "rateFpm": 500, "fuelFlowLph": 0}'::jsonb,
              '{"holdingFuelFlowLph": 0, "maxContinuousFuelFlowLph": 0}'::jsonb,
              'Fiche flotte (avant la préparation de vol) : à compléter depuis le manuel de vol'
       FROM "aircraft" a
       ON CONFLICT ("aircraft_id") DO NOTHING`,
    );
    await queryRunner.query(
      `INSERT INTO "aircraft_mass_balance" ("aircraft_id", "empty_mass_kg", "mtow_kg", "mlw_kg")
       SELECT a."id", a."empty_weight", a."max_takeoff_weight", a."max_takeoff_weight"
       FROM "aircraft" a
       ON CONFLICT ("aircraft_id") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "aircraft_mass_balance"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "aircraft_performance"`);
  }
}
