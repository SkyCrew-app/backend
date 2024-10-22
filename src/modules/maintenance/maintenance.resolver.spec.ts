import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceResolver } from './maintenance.resolver';
import { MaintenanceService } from './maintenance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Maintenance } from './entity/maintenance.entity';
import { AircraftService } from '../aircraft/aircraft.service';

describe('MaintenanceResolver', () => {
  let resolver: MaintenanceResolver;
  let service: MaintenanceService;

  const mockMaintenanceRepository = {
    find: jest.fn(),
  };

  const mockAircraftService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceResolver,
        MaintenanceService,
        {
          provide: getRepositoryToken(Maintenance),
          useValue: mockMaintenanceRepository,
        },
        {
          provide: AircraftService,
          useValue: mockAircraftService,
        },
      ],
    }).compile();

    resolver = module.get<MaintenanceResolver>(MaintenanceResolver);
    service = module.get<MaintenanceService>(MaintenanceService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
