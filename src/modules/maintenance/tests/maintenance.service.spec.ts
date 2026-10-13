import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceService } from '../maintenance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { Maintenance } from '../entity/maintenance.entity';
import { AircraftService } from '../../aircraft/aircraft.service';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { User } from '../../users/entity/users.entity';
import * as fs from 'fs';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Reservation } from '../../reservations/entity/reservations.entity';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let repo: Repository<Maintenance>;
  const mockAircraftService = { findOne: jest.fn() };
  const mockAircraftRepo = { findOne: jest.fn() };
  const mockUserRepo = { findOne: jest.fn() };
  const mockReservationRepo = { find: jest.fn() };
  // Two hours, tomorrow.
  const period = {
    start_date: new Date(Date.now() + 24 * 3_600_000),
    end_date: new Date(Date.now() + 26 * 3_600_000),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        { provide: getRepositoryToken(Maintenance), useClass: Repository },
        { provide: getRepositoryToken(Aircraft), useValue: mockAircraftRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: AircraftService, useValue: mockAircraftService },
        {
          provide: getRepositoryToken(Reservation),
          useValue: mockReservationRepo,
        },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
    repo = module.get<Repository<Maintenance>>(getRepositoryToken(Maintenance));
    jest.spyOn(repo, 'create').mockImplementation((dto) => dto as any);
    jest
      .spyOn(repo, 'save')
      .mockImplementation(async (m) => ({ id: 42, ...m }) as any);
    mockReservationRepo.find.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('remove', () => {
    it('removes an existing maintenance', async () => {
      const maintenance = { id: 5 } as Maintenance;
      jest.spyOn(repo, 'findOne').mockResolvedValue(maintenance);
      const removeSpy = jest
        .spyOn(repo, 'remove')
        .mockResolvedValue(maintenance);

      await expect(service.remove(5)).resolves.toBe(true);
      expect(removeSpy).toHaveBeenCalledWith(maintenance);
    });

    it('throws if the maintenance does not exist', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);
      const removeSpy = jest.spyOn(repo, 'remove');

      await expect(service.remove(5)).rejects.toThrow(NotFoundException);
      expect(removeSpy).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('throws if aircraft not found', async () => {
      mockAircraftService.findOne.mockResolvedValue(null);
      await expect(
        service.create({ aircraft_id: 1 } as any, [], []),
      ).rejects.toThrow(NotFoundException);
    });

    it('assigns the technician and keeps the status', async () => {
      const technician = { id: 9 } as User;
      mockAircraftService.findOne.mockResolvedValue({ id: 1 } as any);
      mockUserRepo.findOne.mockResolvedValue(technician);

      const result = await service.create(
        {
          aircraft_id: 1,
          technician_id: 9,
          status: 'IN_PROGRESS',
          ...period,
        } as any,
        [],
        [],
      );

      expect(mockUserRepo.findOne).toHaveBeenCalledWith({ where: { id: 9 } });
      expect(result.technician).toBe(technician);
      expect(result.status).toBe('IN_PROGRESS');
      expect(result).not.toHaveProperty('technician_id');
    });

    it('saves new maintenance without files/images', async () => {
      mockAircraftService.findOne.mockResolvedValue({ id: 1 } as any);
      const result = await service.create(
        { aircraft_id: 1, ...period } as any,
        [],
        [],
      );
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalledTimes(2); // initial save and final save
      expect(result.id).toBe(42);
      expect(result.documents_url).toBeUndefined();
      expect(result.images_url).toBeUndefined();
    });

    it('moves filePaths and imagePaths into upload dir', async () => {
      mockAircraftService.findOne.mockResolvedValue({ id: 1 } as any);
      const dummyFile = '/tmp/tmpfile.txt';
      const dummyImage = '/tmp/tmpimage.png';
      // Spy on fs methods
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      jest.spyOn(fs, 'mkdirSync').mockImplementation();
      jest.spyOn(fs, 'renameSync').mockImplementation();

      const result = await service.create(
        { aircraft_id: 1, ...period } as any,
        [dummyFile],
        [dummyImage],
      );

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('uploads/maintenance'),
        { recursive: true },
      );
      expect(fs.renameSync).toHaveBeenCalledWith(
        dummyFile,
        expect.stringContaining('/undefined/tmpfile.txt'),
      );
      expect(fs.renameSync).toHaveBeenCalledWith(
        dummyImage,
        expect.stringContaining('/undefined/tmpimage.png'),
      );
      expect(result.documents_url).toEqual([
        `/uploads/maintenance/undefined/tmpfile.txt`,
      ]);
      expect(result.images_url).toEqual([
        `/uploads/maintenance/undefined/tmpimage.png`,
      ]);
    });
  });

  describe('update', () => {
    it('throws if maintenance not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);
      await expect(service.update({ id: 99 } as any, [], [])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates fields and relations', async () => {
      const existing = {
        id: 5,
        aircraft: { id: 1 },
        technician: { id: 2 },
        ...period,
      } as any;
      jest.spyOn(repo, 'findOne').mockResolvedValue(existing);
      mockAircraftRepo.findOne.mockResolvedValue({ id: 9 } as any);
      mockUserRepo.findOne.mockResolvedValue({ id: 8 } as any);
      jest
        .spyOn(repo, 'save')
        .mockImplementation(
          async (m) => ({ ...m, id: (m as any).id || 42 }) as Maintenance,
        );

      const dto = {
        id: 5,
        aircraft_id: 9,
        technician_id: 8,
        status: 'DONE',
      } as any;
      const res = await service.update(dto, [], []);
      expect(existing.aircraft.id).toBe(9);
      expect(existing.technician.id).toBe(8);
      expect(res.status).toBe('DONE');
      expect(repo.save).toHaveBeenCalledWith(existing);
    });

    it('removes the technician when the id is null', async () => {
      const existing = { id: 5, technician: { id: 2 } } as any;
      jest.spyOn(repo, 'findOne').mockResolvedValue(existing);
      jest.spyOn(repo, 'save').mockImplementation(async (m) => m as any);
      mockUserRepo.findOne.mockClear();

      const res = await service.update(
        { id: 5, technician_id: null } as any,
        [],
        [],
      );

      expect(res.technician).toBeNull();
      expect(mockUserRepo.findOne).not.toHaveBeenCalled();
    });

    it('keeps the technician when no id is sent', async () => {
      const existing = { id: 5, technician: { id: 2 } } as any;
      jest.spyOn(repo, 'findOne').mockResolvedValue(existing);
      jest.spyOn(repo, 'save').mockImplementation(async (m) => m as any);

      const res = await service.update(
        { id: 5, status: 'DONE' } as any,
        [],
        [],
      );

      expect(res.technician).toEqual({ id: 2 });
    });
  });

  describe('planning rules', () => {
    const booking = {
      id: 12,
      user: { first_name: 'Jean', last_name: 'Dupont' },
      start_time: new Date(2026, 9, 14, 10, 0),
      end_time: new Date(2026, 9, 14, 12, 0),
    };

    beforeEach(() => {
      mockAircraftService.findOne.mockResolvedValue({ id: 1 } as any);
    });

    it('refuses a maintenance planned over bookings and names them', async () => {
      mockReservationRepo.find.mockResolvedValue([booking]);

      const planning = service.create(
        { aircraft_id: 1, ...period } as any,
        [],
        [],
      );

      await expect(planning).rejects.toThrow(ConflictException);
      await expect(planning).rejects.toThrow(
        'N°12 Jean Dupont (14/10/2026 10:00 – 14/10/2026 12:00)',
      );
      expect(repo.save).not.toHaveBeenCalled();
      // Bookings of that aircraft that share time with the maintenance.
      expect(mockReservationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ aircraft: { id: 1 } }),
        }),
      );
    });

    it('refuses to move a maintenance over bookings', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue({
        id: 5,
        aircraft: { id: 1 },
        ...period,
      } as any);
      mockReservationRepo.find.mockResolvedValue([booking]);

      await expect(
        service.update(
          {
            id: 5,
            start_date: new Date(2026, 9, 14, 8, 0),
            end_date: new Date(2026, 9, 14, 18, 0),
          } as any,
          [],
          [],
        ),
      ).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('does not look at bookings again when the slot stays the same', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue({
        id: 5,
        aircraft: { id: 1 },
        ...period,
      } as any);
      mockReservationRepo.find.mockResolvedValue([booking]);

      await expect(
        service.update({ id: 5, description: 'Vidange' } as any, [], []),
      ).resolves.toMatchObject({ description: 'Vidange' });
      expect(mockReservationRepo.find).not.toHaveBeenCalled();
    });

    it('lets a finished maintenance be recorded whatever the bookings', async () => {
      mockReservationRepo.find.mockResolvedValue([booking]);

      await expect(
        service.create(
          { aircraft_id: 1, status: 'COMPLETED', ...period } as any,
          [],
          [],
        ),
      ).resolves.toMatchObject({ status: 'COMPLETED' });
    });

    it('refuses a maintenance that ends before it starts', async () => {
      await expect(
        service.create(
          {
            aircraft_id: 1,
            start_date: period.start_date,
            end_date: new Date(period.start_date.getTime() - 1000),
          } as any,
          [],
          [],
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('holds the aircraft through the last day: a one-day maintenance runs into the bookings of that day', async () => {
      const day = new Date(2026, 9, 14);
      mockReservationRepo.find.mockResolvedValue([booking]);

      await expect(
        service.create(
          { aircraft_id: 1, start_date: day, end_date: day } as any,
          [],
          [],
        ),
      ).rejects.toThrow(ConflictException);

      const { where } = mockReservationRepo.find.mock.calls[0][0];
      // Bookings starting before the end of that day and ending after its start.
      expect(where.start_time).toEqual(LessThan(new Date(2026, 9, 15)));
      expect(where.end_time).toEqual(MoreThan(day));
    });

    it('refuses an unknown technician instead of ignoring it', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(
          { aircraft_id: 1, technician_id: 404, ...period } as any,
          [],
          [],
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns when found', async () => {
      const obj = { id: 7 } as any;
      jest.spyOn(repo, 'findOne').mockResolvedValue(obj);
      await expect(service.findOne(7)).resolves.toEqual(obj);
    });

    it('throws if not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);
      await expect(service.findOne(8)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllByAircraft', () => {
    it('calls repository.find with relations', async () => {
      const arr = [{ id: 1 }];
      jest.spyOn(repo, 'find').mockResolvedValue(arr as any);
      await expect(service.findAllByAircraft(1)).resolves.toBe(arr as any);
    });
  });

  describe('findAll', () => {
    it('calls repository.find with relations', async () => {
      const arr = [{ id: 2 }];
      jest.spyOn(repo, 'find').mockResolvedValue(arr as any);
      await expect(service.findAll()).resolves.toBe(arr as any);
    });
  });
});
