import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceService } from './maintenance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Maintenance } from './entity/maintenance.entity';
import { Repository } from 'typeorm';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let repository: Repository<Maintenance>;

  const mockMaintenanceRepository = {
    find: jest.fn().mockResolvedValue([{ id: 1, maintenance_type: 'Routine' }]),
    findOne: jest
      .fn()
      .mockResolvedValue({ id: 1, maintenance_type: 'Routine' }),
    save: jest.fn().mockResolvedValue({ id: 1, maintenance_type: 'Routine' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        {
          provide: getRepositoryToken(Maintenance),
          useValue: mockMaintenanceRepository,
        },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
    repository = module.get<Repository<Maintenance>>(
      getRepositoryToken(Maintenance),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return a list of maintenances', async () => {
    const result = await service.findAll();
    expect(result).toEqual([{ id: 1, maintenance_type: 'Routine' }]);
  });

  it('should return a single maintenance by ID', async () => {
    const result = await service.findOne(1);
    expect(result).toEqual({ id: 1, maintenance_type: 'Routine' });
    expect(mockMaintenanceRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  // it('should create a new maintenance record', async () => {
  //   const newMaintenance = { maintenance_type: 'Emergency' };
  //   const result = await service.create(newMaintenance);
  //   expect(result).toEqual({ id: 1, maintenance_type: 'Routine' });
  //   expect(mockMaintenanceRepository.save).toHaveBeenCalledWith(newMaintenance);
  // });
});
