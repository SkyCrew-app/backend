import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceService } from './maintenance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Maintenance } from './entity/maintenance.entity';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { AircraftService } from '../aircraft/aircraft.service';

jest.mock('fs');

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let maintenanceRepository: Partial<Repository<Maintenance>>;
  let aircraftService: Partial<AircraftService>;

  beforeEach(async () => {
    maintenanceRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    aircraftService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        {
          provide: getRepositoryToken(Maintenance),
          useValue: maintenanceRepository,
        },
        { provide: AircraftService, useValue: aircraftService },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a maintenance and move files', async () => {
    const createMaintenanceInput = {
      aircraft_id: 1,
      description: 'Engine check',
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-10'),
    };

    const savedMaintenance = {
      id: 1,
      ...createMaintenanceInput,
      documents_url: [],
      images_url: [],
    };

    const aircraft = { id: 1 };
    (aircraftService.findOne as jest.Mock).mockResolvedValue(aircraft);
    (maintenanceRepository.create as jest.Mock).mockReturnValue(
      savedMaintenance,
    );
    (maintenanceRepository.save as jest.Mock).mockResolvedValue(
      savedMaintenance,
    );
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.renameSync as jest.Mock).mockReturnValue(undefined);

    const result = await service.create(createMaintenanceInput, [], []);

    expect(aircraftService.findOne).toHaveBeenCalledWith(1);
    expect(maintenanceRepository.create).toHaveBeenCalledWith({
      ...createMaintenanceInput,
      aircraft,
    });
    expect(maintenanceRepository.save).toHaveBeenCalledWith(savedMaintenance);
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(result).toEqual(savedMaintenance);
  });

  it('should update maintenance and move files', async () => {
    const updateMaintenanceInput = {
      id: 1,
      description: 'Engine overhaul',
    };

    const existingMaintenance = {
      id: 1,
      description: 'Old description',
      documents_url: [],
      images_url: [],
    };

    (maintenanceRepository.findOne as jest.Mock).mockResolvedValue(
      existingMaintenance,
    );
    (maintenanceRepository.save as jest.Mock).mockResolvedValue(
      existingMaintenance,
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const result = await service.update(updateMaintenanceInput, [], []);

    expect(maintenanceRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(maintenanceRepository.save).toHaveBeenCalledWith(
      existingMaintenance,
    );
    expect(result).toEqual(existingMaintenance);
  });

  it('should throw error if maintenance not found during update', async () => {
    (maintenanceRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.update({ id: 1, description: 'Update' }, [], []),
    ).rejects.toThrow('Maintenance not found');
  });

  it('should find a maintenance by id', async () => {
    const maintenance = { id: 1 };
    (maintenanceRepository.findOne as jest.Mock).mockResolvedValue(maintenance);

    const result = await service.findOne(1);

    expect(maintenanceRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(result).toEqual(maintenance);
  });

  it('should throw error if maintenance not found', async () => {
    (maintenanceRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.findOne(1)).rejects.toThrow('Maintenance not found');
  });
});
