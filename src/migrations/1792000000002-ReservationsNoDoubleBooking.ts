import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';

const TIME_ORDER_CHECK = 'CHK_reservations_time_order';
const SLOT_EXCLUSION = 'EXC_reservations_aircraft_slot';

// The database itself refuses a booking that ends before it starts, and two
// bookings of the same aircraft over the same time.
export class ReservationsNoDoubleBooking1792000000002
  implements MigrationInterface
{
  name = 'ReservationsNoDoubleBooking1792000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // NOT VALID: the rule applies to every new or changed row, and rows
    // already there are not examined, so it cannot fail on existing data.
    await queryRunner.query(
      `DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = '${TIME_ORDER_CHECK}'
        ) THEN
          ALTER TABLE "reservations" ADD CONSTRAINT "${TIME_ORDER_CHECK}" CHECK ("end_time" > "start_time") NOT VALID;
        END IF;
      END $$`,
    );

    // The exclusion constraint cannot be created while existing bookings
    // overlap, or without the btree_gist extension. Migrations run when the
    // server starts: rather than stop it, the attempt is made in a block of
    // its own (a failure there leaves the rest of the migration intact) and
    // a warning says what to do. The application also checks overlaps
    // itself, under a lock on the aircraft, so bookings stay safe meanwhile.
    await queryRunner.query(
      `DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = '${SLOT_EXCLUSION}'
        ) THEN
          BEGIN
            CREATE EXTENSION IF NOT EXISTS btree_gist;
            ALTER TABLE "reservations" ADD CONSTRAINT "${SLOT_EXCLUSION}"
              EXCLUDE USING gist ("aircraftId" WITH =, tsrange("start_time", "end_time") WITH &&)
              WHERE ("end_time" > "start_time" AND "status" <> 'cancelled');
          EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Constraint ${SLOT_EXCLUSION} not created: %', SQLERRM;
          END;
        END IF;
      END $$`,
    );

    const created = await queryRunner.query(
      `SELECT 1 FROM pg_constraint WHERE conname = '${SLOT_EXCLUSION}'`,
    );
    if (created.length === 0) {
      const overlaps = await queryRunner.query(
        `SELECT a."id" AS "first", b."id" AS "second"
         FROM "reservations" a
         JOIN "reservations" b
           ON a."aircraftId" = b."aircraftId"
          AND a."id" < b."id"
          AND a."start_time" < b."end_time"
          AND b."start_time" < a."end_time"
         WHERE a."end_time" > a."start_time" AND b."end_time" > b."start_time"
           AND a."status" <> 'cancelled' AND b."status" <> 'cancelled'
         LIMIT 20`,
      );
      new Logger('Migration').warn(
        `The database guard against double bookings (${SLOT_EXCLUSION}) was NOT created. ` +
          (overlaps.length > 0
            ? `Existing bookings overlap (pairs of ids: ${overlaps
                .map((pair) => `${pair.first}/${pair.second}`)
                .join(', ')}). Cancel one of each pair, then run: `
            : `The btree_gist extension is probably not allowed for this database user. Have it installed, then run: `) +
          `ALTER TABLE "reservations" ADD CONSTRAINT "${SLOT_EXCLUSION}" EXCLUDE USING gist ("aircraftId" WITH =, tsrange("start_time", "end_time") WITH &&) WHERE ("end_time" > "start_time" AND "status" <> 'cancelled');`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "${SLOT_EXCLUSION}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "${TIME_ORDER_CHECK}"`,
    );
  }
}
