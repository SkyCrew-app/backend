import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateFlightInput } from '../dto/update-flight.input';

const errorsOf = async (values: object) =>
  (
    await validate(plainToInstance(UpdateFlightInput, { id: 1, ...values }))
  ).map((error) => error.property);

describe('UpdateFlightInput', () => {
  it('accepts what the close-flight form sends', async () => {
    await expect(
      errorsOf({
        flight_hours: 1.5,
        number_of_passengers: 2,
        distance_km: 120.4,
        estimated_flight_time: 1.4,
        remarks: 'RAS',
        closed: true,
      }),
    ).resolves.toEqual([]);
  });

  it.each([
    ['a negative number of passengers', { number_of_passengers: -1 }],
    ['a negative distance', { distance_km: -5 }],
    ['a negative estimated time', { estimated_flight_time: -1 }],
    ['a duration that is not a number', { flight_hours: 'beaucoup' }],
  ])('refuses %s', async (_label, values) => {
    await expect(errorsOf(values)).resolves.toEqual(Object.keys(values));
  });
});
