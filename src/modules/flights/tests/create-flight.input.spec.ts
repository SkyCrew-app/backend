import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateFlightInput } from '../dto/create-flight.input';

const input = (overrides: Record<string, unknown> = {}) =>
  plainToInstance(CreateFlightInput, {
    user_id: 3,
    flight_hours: 1.5,
    flight_type: 'VFR',
    origin_icao: 'LFPG',
    destination_icao: 'LFPO',
    ...overrides,
  });

const failingProperties = async (value: CreateFlightInput) =>
  (await validate(value)).map((error) => error.property);

describe('CreateFlightInput', () => {
  // The flight-plan form sends flight rules, a reservation sends its category.
  it.each(['VFR', 'IFR', 'SVFR', 'LOCAL', 'TRAINING'])(
    'accepts %s as flight type',
    async (flightType) => {
      expect(
        await failingProperties(input({ flight_type: flightType })),
      ).not.toContain('flight_type');
    },
  );

  it('requires a flight type', async () => {
    expect(await failingProperties(input({ flight_type: '' }))).toContain(
      'flight_type',
    );
  });
});
