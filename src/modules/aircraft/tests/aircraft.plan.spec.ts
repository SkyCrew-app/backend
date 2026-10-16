import * as fs from 'fs';
import { translationOf } from '../../../common/i18n/localized-exception';
import { PlanService } from '../../../common/plan/plan.service';
import { AircraftService } from '../aircraft.service';
import { Aircraft, AvailabilityStatus } from '../entity/aircraft.entity';

const refusal = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (caught) => caught,
  );
  return translationOf(error)?.key ?? error?.message ?? null;
};

// A fleet of `inService` aircraft in service, and one more (id 9) that is
// stored with the given status.
const fleet = (
  inService: number,
  maxAircraft: number | null,
  stored: AvailabilityStatus = AvailabilityStatus.UNAVAILABLE,
) => {
  const manager = {
    count: jest.fn().mockResolvedValue(inService),
    find: jest.fn().mockResolvedValue([]),
  };
  const repository = {
    manager,
    create: jest.fn((input) => ({ ...input })),
    save: jest.fn(async (aircraft) => ({ id: 9, ...aircraft })),
    findOneOrFail: jest.fn(async () => ({
      id: 9,
      availability_status: stored,
    })),
  };
  const service = new AircraftService(
    repository as any,
    PlanService.of({ maxAircraft }),
  );
  return { service, repository, manager };
};

// What the database requires of a new aircraft.
const REQUIRED = {
  model: 'DR400',
  year_of_manufacture: 2000,
  hourly_cost: 150,
};

describe('The aircraft limit of the plan', () => {
  beforeEach(() => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'renameSync').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('adds an aircraft while places are left', async () => {
    const { service, repository } = fleet(2, 3);

    await service.create(
      { ...REQUIRED, registration_number: 'F-NEW' } as any,
      [],
      null,
    );

    expect(repository.save).toHaveBeenCalled();
  });

  it('refuses a new aircraft in service once every place is used, before saving or moving any file', async () => {
    const { service, repository } = fleet(3, 3);

    expect(
      await refusal(
        service.create(
          { ...REQUIRED, registration_number: 'F-NEW' } as any,
          ['doc'],
          null,
        ),
      ),
    ).toBe('error.plan.aircraftLimit');
    expect(repository.save).not.toHaveBeenCalled();
    expect(fs.renameSync).not.toHaveBeenCalled();
  });

  it('counts only the aircraft in service', async () => {
    const { service, manager } = fleet(3, 3);

    await service
      .create({ ...REQUIRED, registration_number: 'F-NEW' } as any, [], null)
      .catch(() => null);

    expect(manager.count).toHaveBeenCalledWith(Aircraft, {
      where: {
        availability_status: expect.objectContaining({
          _type: 'not',
          _value: AvailabilityStatus.UNAVAILABLE,
        }),
      },
    });
  });

  it('still records an aircraft out of service, which takes no place', async () => {
    const { service, repository } = fleet(3, 3);

    await service.create(
      {
        ...REQUIRED,
        registration_number: 'F-OLD',
        availability_status: AvailabilityStatus.UNAVAILABLE,
      } as any,
      [],
      null,
    );

    expect(repository.save).toHaveBeenCalled();
  });

  it('refuses putting an aircraft back in service once every place is used', async () => {
    const { service, repository } = fleet(3, 3);

    expect(
      await refusal(service.updateStatus(9, AvailabilityStatus.AVAILABLE)),
    ).toBe('error.plan.aircraftLimit');
    expect(
      await refusal(
        service.update(
          9,
          { availability_status: AvailabilityStatus.AVAILABLE } as any,
          [],
          null,
        ),
      ),
    ).toBe('error.plan.aircraftLimit');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('never blocks an aircraft already in service above the limit', async () => {
    const { service, repository } = fleet(5, 3, AvailabilityStatus.AVAILABLE);

    await service.updateStatus(9, AvailabilityStatus.RESERVATED);
    await service.updateStatus(9, AvailabilityStatus.UNAVAILABLE);
    await service.update(9, { model: 'DR400' } as any, [], null);

    expect(repository.save).toHaveBeenCalledTimes(3);
  });

  it('counts nothing when the plan has no limit', async () => {
    const { service, manager } = fleet(50, null);

    await service.create(
      { ...REQUIRED, registration_number: 'F-NEW' } as any,
      [],
      null,
    );

    expect(manager.count).not.toHaveBeenCalled();
  });
});
