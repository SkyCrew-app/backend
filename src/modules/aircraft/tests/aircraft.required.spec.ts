import * as fs from 'fs';
import { BadRequestException } from '@nestjs/common';
import { translationOf } from '../../../common/i18n/localized-exception';
import { PlanService } from '../../../common/plan/plan.service';
import { AircraftService } from '../aircraft.service';

// A creation without the year of manufacture used to reach the database and
// come back as a raw 500 ("null value in column year_of_manufacture").
describe('The fields an aircraft cannot do without', () => {
  beforeEach(() => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'renameSync').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  const service = () => {
    const repository = {
      manager: { count: jest.fn().mockResolvedValue(0) },
      create: jest.fn((input) => ({ ...input })),
      save: jest.fn(async (aircraft) => ({ id: 9, ...aircraft })),
      findOneOrFail: jest.fn(async () => ({ id: 9 })),
    };
    return {
      repository,
      service: new AircraftService(
        repository as any,
        PlanService.of({ maxAircraft: null }),
      ),
    };
  };
  const complete = {
    registration_number: 'F-NEW',
    model: 'Robin DR400-180',
    year_of_manufacture: 1998,
    hourly_cost: 150,
  };
  const refusal = async (promise: Promise<unknown>) => {
    const error = await promise.then(
      () => null,
      (caught) => caught,
    );
    expect(error).toBeInstanceOf(BadRequestException);
    return translationOf(error);
  };

  it('refuses a new aircraft without a year of manufacture, with a message, before saving', async () => {
    const { service: s, repository } = service();
    const withoutYear: Partial<typeof complete> = { ...complete };
    delete withoutYear.year_of_manufacture;
    expect(await refusal(s.create(withoutYear as any, [], null))).toEqual({
      key: 'error.aircraft.yearRequired',
      params: { min: 1903, max: new Date().getFullYear() },
    });
    expect(
      (
        await refusal(
          s.create({ ...complete, year_of_manufacture: 1850 }, [], null),
        )
      )?.key,
    ).toBe('error.aircraft.yearRequired');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('refuses the other required fields the same way', async () => {
    const { service: s } = service();
    for (const [field, key] of [
      ['registration_number', 'error.aircraft.registrationRequired'],
      ['model', 'error.aircraft.modelRequired'],
      ['hourly_cost', 'error.aircraft.hourlyCostRequired'],
    ]) {
      expect(
        (
          await refusal(
            s.create({ ...complete, [field]: null } as any, [], null),
          )
        )?.key,
      ).toBe(key);
    }
  });

  it('creates a complete aircraft; an update may leave the year out but not empty it', async () => {
    const { service: s, repository } = service();
    await s.create(complete, [], null);
    expect(repository.save).toHaveBeenCalled();
    await s.update(9, { model: 'Robin DR400-180 Régent' } as any, [], null);
    expect(
      (
        await refusal(
          s.update(9, { year_of_manufacture: null } as any, [], null),
        )
      )?.key,
    ).toBe('error.aircraft.yearRequired');
  });
});
