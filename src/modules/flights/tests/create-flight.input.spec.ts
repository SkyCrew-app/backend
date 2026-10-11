import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateFlightInput } from '../dto/create-flight.input';
import { UpdateFlightInput } from '../dto/update-flight.input';

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

describe('UpdateFlightInput remarks', () => {
  const errorsFor = async (remarks: unknown) =>
    validate(plainToInstance(UpdateFlightInput, { id: 1, remarks }));

  it('accepts the remarks written when closing a flight, or none', async () => {
    await expect(
      errorsFor('Vent de travers à l’atterrissage'),
    ).resolves.toEqual([]);
    await expect(errorsFor(undefined)).resolves.toEqual([]);
  });

  it('refuses remarks that are not a text or are too long', async () => {
    expect(await errorsFor(42)).toHaveLength(1);
    expect(await errorsFor('a'.repeat(2001))).toHaveLength(1);
  });
});
