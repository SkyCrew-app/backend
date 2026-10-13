import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAircraftInput } from '../dto/update-aircraft.input';
import { CreateAircraftInput } from '../dto/create-aircraft.input';

describe('aircraft inputs', () => {
  it('lets an administrator set the hours already on the airframe', async () => {
    const input = plainToInstance(UpdateAircraftInput, {
      total_flight_hours: 1245.5,
      hourly_cost: 150,
    });
    await expect(validate(input)).resolves.toEqual([]);
  });

  it.each([
    ['a negative hourly cost on update', UpdateAircraftInput, 'hourly_cost'],
    ['negative hours on update', UpdateAircraftInput, 'total_flight_hours'],
    ['a negative hourly cost on creation', CreateAircraftInput, 'hourly_cost'],
  ])('refuses %s', async (_label, Input, field) => {
    const errors = await validate(
      plainToInstance(Input as any, { [field]: -1 }) as object,
    );
    expect(errors.map((error) => error.property)).toEqual([field]);
  });
});
