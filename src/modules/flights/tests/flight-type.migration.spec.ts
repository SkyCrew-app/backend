import {
  FLIGHT_CATEGORIES,
  FlightTypeIsBookingCategory1802000000001,
} from '../../../migrations/1802000000001-FlightTypeIsBookingCategory';
import { FlightCategory } from '../../reservations/entity/reservations.entity';
import { DEFAULT_FLIGHT_TYPE, flightTypeOf } from '../flight-rules';

describe('flight type migration', () => {
  const statements = async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    await new FlightTypeIsBookingCategory1802000000001().up(queryRunner as any);
    return queryRunner.query.mock.calls.map(([sql]) =>
      String(sql).replace(/\s+/g, ' ').trim(),
    );
  };

  it('knows the same categories as the bookings', () => {
    expect([...FLIGHT_CATEGORIES].sort((a, b) => a.localeCompare(b))).toEqual(
      Object.values(FlightCategory).sort((a, b) => a.localeCompare(b)),
    );
  });

  it('gives the other flights the category of their booking, else local', async () => {
    const [update, ...rest] = await statements();
    expect(rest).toEqual([]);
    expect(update).toContain(
      `SET "flight_type" = COALESCE( (SELECT r."flight_category"::text FROM "reservations" r WHERE r."id" = f."reservationId"), '${DEFAULT_FLIGHT_TYPE}')`,
    );
    expect(update).toContain(
      `WHERE f."flight_type" IS NULL OR f."flight_type" NOT IN ('local', 'cross_country', 'instruction', 'tourism', 'training', 'maintenance', 'private', 'corporate')`,
    );
  });

  it('reads a category whatever its case, and nothing else', () => {
    expect(flightTypeOf(' Cross_Country')).toBe('cross_country');
    for (const old of ['VFR', 'IFR', 'SVFR', 'Generated via AI', '', null])
      expect(flightTypeOf(old)).toBeNull();
  });
});
