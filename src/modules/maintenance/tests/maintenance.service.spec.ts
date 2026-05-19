import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceService } from '../maintenance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Maintenance } from '../entity/maintenance.entity';
import { AircraftService } from '../../aircraft/aircraft.service';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { User } from '../../users/entity/users.entity';
import * as fs from 'fs';
import { NotFoundException } from '@nestjs/common';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let repo: Repository<Maintenance>;
  const mockAircraftService = { findOne: jest.fn() };
  const mockAircraftRepo = { findOne: jest.fn() };
  const mockUserRepo = { findOne: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        { provide: getRepositoryToken(Maintenance), useClass: Repository },
        { provide: getRepositoryToken(Aircraft), useValue: mockAircraftRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: AircraftService, useValue: mockAircraftService },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
    repo = module.get<Repository<Maintenance>>(getRepositoryToken(Maintenance));
    jest.spyOn(repo, 'create').mockImplementation((dto) => dto as any);
    jest
      .spyOn(repo, 'save')
      .mockImplementation(async (m) => ({ id: 42, ...m }) as any);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('create', () => {
    it('throws if aircraft not found', async () => {
      mockAircraftService.findOne.mockResolvedValue(null);
      await expect(
        service.create({ aircraft_id: 1 } as any, [], []),
      ).rejects.toThrow(NotFoundException);
    });

    it('saves new maintenance without files/images', async () => {
      mockAircraftService.findOne.mockResolvedValue({ id: 1 } as any);
      const result = await service.create(
        { aircraft_id: 1, start_date: new Date(), end_date: new Date() } as any,
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
        { aircraft_id: 1, start_date: new Date(), end_date: new Date() } as any,
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
