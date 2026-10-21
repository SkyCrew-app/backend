import { MigrationInterface, QueryRunner } from 'typeorm';

// The type of a flight is the category of its booking (FlightCategory).
// Older rows hold a flight rule ('VFR', 'IFR', 'SVFR') or a label ("Generated
// via AI"): they take the category of their booking, 'local' when they have
// none. Running it again changes nothing.
export const FLIGHT_CATEGORIES = [
  'local',
  'cross_country',
  'instruction',
  'tourism',
  'training',
  'maintenance',
  'private',
  'corporate',
];

const list = FLIGHT_CATEGORIES.map((c) => `'${c}'`).join(', ');

export class FlightTypeIsBookingCategory1802000000001
  implements MigrationInterface
{
  name = 'FlightTypeIsBookingCategory1802000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "flights" AS f
          SET "flight_type" = COALESCE(
            (SELECT r."flight_category"::text FROM "reservations" r WHERE r."id" = f."reservationId"),
            'local')
        WHERE f."flight_type" IS NULL OR f."flight_type" NOT IN (${list})`,
    );
  }

  // The values replaced are not kept: there is nothing to put back.
  public async down(): Promise<void> {}
}
