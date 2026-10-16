/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { AircraftService } from '../aircraft.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Aircraft, AvailabilityStatus } from '../entity/aircraft.entity';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { ConflictException } from '@nestjs/common';
import { Reservation } from '../../reservations/entity/reservations.entity';
import { Maintenance } from '../../maintenance/entity/maintenance.entity';

describe('AircraftService', () => {
  let service: AircraftService;
  let repo: Partial<Repository<Aircraft>>;
  let manager: { count: jest.Mock; find: jest.Mock };

  beforeEach(async () => {
    manager = {
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockResolvedValue([]),
    };
    repo = {
      manager: manager as any,
      create: jest.fn().mockImplementation((dto) => dto as Aircraft),
      save: jest.fn().mockResolvedValue({ id: 1 } as Aircraft),
      find: jest.fn().mockResolvedValue([]),
      findOneOrFail: jest.fn().mockResolvedValue({ id: 1 } as Aircraft),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    jest
      .spyOn(fs, 'mkdirSync')
      .mockImplementation(((p: any, opts?: any) => p) as any);
    jest.spyOn(fs, 'renameSync').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AircraftService,
        { provide: getRepositoryToken(Aircraft), useValue: repo },
      ],
    }).compile();

    service = module.get<AircraftService>(AircraftService);
  });

  it('findAll devrait récupérer toutes les entités', async () => {
    await expect(service.findAll()).resolves.toEqual([]);
    expect(repo.find).toHaveBeenCalledWith({
      // Bookings are resolved on demand (AircraftResolver.reservations).
      relations: ['maintenances'],
    });
  });

  it('create devrait gérer upload et sauvegarder', async () => {
    const dto = {
      registration_number: 'F-TEST',
      model: 'DR400',
      year_of_manufacture: 2000,
      hourly_cost: 150,
    } as any;
    const result = await service.create(dto, ['f1'], 'i1');
    expect(repo.create).toHaveBeenCalledWith(dto);
    expect(fs.renameSync).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
    expect(result).toHaveProperty('id', 1);
  });

  it('update devrait renommer fichiers et sauvegarder', async () => {
    const dto = {} as any;
    const result = await service.update(1, dto, ['f2'], 'i2');
    expect(repo.findOneOrFail).toHaveBeenCalled();
    expect(fs.renameSync).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
  });

  describe('aircraft held by a maintenance', () => {
    const hour = 3_600_000;
    const running = {
      start_date: new Date(Date.now() - hour),
      end_date: new Date(Date.now() + hour),
      status: 'PLANNED',
    };

    it.each([
      ['a maintenance whose dates cover now', running, true],
      [
        'a maintenance in progress that overran its dates',
        {
          start_date: new Date(Date.now() - 3 * hour),
          end_date: new Date(Date.now() - hour),
          status: 'IN_PROGRESS',
        },
        true,
      ],
      [
        'a planned maintenance on its last day',
        {
          start_date: new Date(Date.now() - 48 * hour),
          // Dates are days: the stored end is the start of the last day.
          end_date: new Date(Date.now() - 2 * hour),
          status: 'PLANNED',
        },
        true,
      ],
      [
        'a planned maintenance that ended days ago',
        {
          start_date: new Date(Date.now() - 96 * hour),
          end_date: new Date(Date.now() - 48 * hour),
          status: 'PLANNED',
        },
        false,
      ],
      ['a completed maintenance', { ...running, status: 'COMPLETED' }, false],
      ['a cancelled maintenance', { ...running, status: 'CANCELLED' }, false],
      [
        'a maintenance planned for later',
        {
          start_date: new Date(Date.now() + hour),
          end_date: new Date(Date.now() + 2 * hour),
          status: 'PLANNED',
        },
        false,
      ],
    ])(
      'lists the aircraft as it is with %s',
      async (_label, maintenance, held) => {
        (repo.find as jest.Mock).mockResolvedValue([
          {
            id: 1,
            availability_status: AvailabilityStatus.AVAILABLE,
            maintenance_status: 'OK',
            maintenances: [maintenance],
          },
        ]);

        const [aircraft] = await service.findAll();

        expect(aircraft.availability_status).toBe(
          held ? AvailabilityStatus.UNAVAILABLE : AvailabilityStatus.AVAILABLE,
        );
        expect(aircraft.maintenance_status).toBe(
          held ? 'En maintenance' : 'OK',
        );
        // Nothing is written: the stored status comes back afterwards.
        expect(repo.save).not.toHaveBeenCalled();
      },
    );

    it('does not store the status shown during the maintenance when the form sends it back', async () => {
      manager.find.mockResolvedValue([running]);
      (repo.findOneOrFail as jest.Mock).mockResolvedValue({
        id: 1,
        availability_status: AvailabilityStatus.AVAILABLE,
        maintenance_status: 'OK',
      });

      await service.update(
        1,
        {
          hourly_cost: 150,
          availability_status: AvailabilityStatus.UNAVAILABLE,
          maintenance_status: 'En maintenance',
        } as any,
        [],
        null,
      );

      expect(manager.find).toHaveBeenCalledWith(Maintenance, {
        where: { aircraft: { id: 1 } },
      });
      expect(repo.save).toHaveBeenCalledWith({
        id: 1,
        hourly_cost: 150,
        availability_status: AvailabilityStatus.AVAILABLE,
        maintenance_status: 'OK',
      });
    });

    it('refuses to make the aircraft available while the maintenance holds it', async () => {
      manager.find.mockResolvedValue([running]);

      await expect(
        service.update(
          1,
          { availability_status: AvailabilityStatus.AVAILABLE } as any,
          [],
          null,
        ),
      ).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    let rmSpy: jest.SpyInstance;

    beforeEach(() => {
      rmSpy = jest.spyOn(fs, 'rmSync').mockImplementation(() => {});
      rmSpy.mockClear();
    });

    // This test used to assert that the folder was erased before the row.
    it('deletes an aircraft nothing refers to, the row before its files', async () => {
      const order: string[] = [];
      (repo.remove as jest.Mock).mockImplementation(async () => {
        order.push('row');
      });
      rmSpy.mockImplementation(() => {
        order.push('files');
      });

      await expect(service.remove(1)).resolves.toBe(true);

      expect(order).toEqual(['row', 'files']);
    });

    it('keeps the files when the database refuses the deletion', async () => {
      (repo.remove as jest.Mock).mockRejectedValue(new Error('foreign key'));

      await expect(service.remove(1)).rejects.toThrow('foreign key');
      expect(rmSpy).not.toHaveBeenCalled();
    });

    it('retires an aircraft that has a history instead of deleting it', async () => {
      // No upcoming booking, but past ones.
      manager.count.mockImplementation(async (entity, options) =>
        entity === Reservation && !options.where.end_time ? 3 : 0,
      );

      await expect(service.remove(1)).resolves.toBe(false);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          availability_status: AvailabilityStatus.UNAVAILABLE,
        }),
      );
      expect(repo.remove).not.toHaveBeenCalled();
      expect(rmSpy).not.toHaveBeenCalled();
    });

    it('refuses, with the reason, while the aircraft has upcoming bookings', async () => {
      manager.count.mockImplementation(async (entity, options) =>
        entity === Reservation && options.where.end_time ? 2 : 0,
      );

      await expect(service.remove(1)).rejects.toThrow(
        'Cet avion a 2 réservation(s) à venir',
      );
      expect(repo.save).not.toHaveBeenCalled();
      expect(repo.remove).not.toHaveBeenCalled();
      expect(rmSpy).not.toHaveBeenCalled();
    });
  });
});
