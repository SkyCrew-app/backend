import { MigrationInterface, QueryRunner } from 'typeorm';

// Hour totals of members and aircraft were whole numbers, so each closed
// flight was rounded to the hour, and a member without a value never got one.
// They become decimals that are always filled in. An aircraft whose total
// was never maintained (0) starts from the closed flights flown on it.
export class StoreFlightHourTotalsAsDecimals1792100000001
  implements MigrationInterface
{
  name = 'StoreFlightHourTotalsAsDecimals1792100000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['users', 'aircraft']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "total_flight_hours" TYPE double precision USING "total_flight_hours"::double precision`,
      );
      await queryRunner.query(
        `UPDATE "${table}" SET "total_flight_hours" = 0 WHERE "total_flight_hours" IS NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "total_flight_hours" SET DEFAULT 0`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "total_flight_hours" SET NOT NULL`,
      );
    }

    await queryRunner.query(
      `UPDATE "aircraft" AS a
       SET "total_flight_hours" = flown.hours
       FROM (
         SELECT r."aircraftId" AS aircraft_id, SUM(f."flight_hours") AS hours
         FROM "flights" f
         JOIN "reservations" r ON r."id" = f."reservationId"
         WHERE f."closed_at" IS NOT NULL
         GROUP BY r."aircraftId"
       ) AS flown
       WHERE flown.aircraft_id = a."id"
         AND a."total_flight_hours" = 0
         AND flown.hours > 0`,
    );
  }

  // Back to whole numbers; the totals computed for aircraft are kept, rounded.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "total_flight_hours" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "total_flight_hours" DROP DEFAULT`,
    );
    for (const table of ['users', 'aircraft']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "total_flight_hours" TYPE integer USING round("total_flight_hours")::integer`,
      );
    }
  }
}
