import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceResolver } from './maintenance.resolver';
import { MaintenanceService } from './maintenance.service';

describe('MaintenanceResolver', () => {
  let resolver: MaintenanceResolver;
  let maintenanceService: Partial<MaintenanceService>;

  beforeEach(async () => {
    maintenanceService = {
      create: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
      findAllByAircraft: jest.fn(),
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceResolver,
        { provide: MaintenanceService, useValue: maintenanceService },
      ],
    }).compile();

    resolver = module.get<MaintenanceResolver>(MaintenanceResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should create a maintenance', async () => {
    const createMaintenanceInput = {
      aircraft_id: 1,
      description: 'Engine check',
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-10'),
    };
    const maintenance = { id: 1, ...createMaintenanceInput };

    (maintenanceService.create as jest.Mock).mockResolvedValue(maintenance);

    const result = await resolver.createMaintenance(
      createMaintenanceInput,
      [],
      [],
    );

    expect(maintenanceService.create).toHaveBeenCalledWith(
      createMaintenanceInput,
      [],
      [],
    );
    expect(result).toEqual(maintenance);
  });

  it('should update a maintenance', async () => {
    const updateMaintenanceInput = {
      id: 1,
      description: 'Updated description',
    };
    const maintenance = { id: 1, description: 'Updated description' };

    (maintenanceService.update as jest.Mock).mockResolvedValue(maintenance);

    const result = await resolver.updateMaintenance(
      updateMaintenanceInput,
      [],
      [],
    );

    expect(maintenanceService.update).toHaveBeenCalledWith(
      updateMaintenanceInput,
      [],
      [],
    );
    expect(result).toEqual(maintenance);
  });

  it('should find a maintenance by id', async () => {
    const maintenance = { id: 1 };

    (maintenanceService.findOne as jest.Mock).mockResolvedValue(maintenance);

    const result = await resolver.getMaintenance(1);

    expect(maintenanceService.findOne).toHaveBeenCalledWith(1);
    expect(result).toEqual(maintenance);
  });

  it('should find all maintenances by aircraft', async () => {
    const maintenances = [{ id: 1 }, { id: 2 }];

    (maintenanceService.findAllByAircraft as jest.Mock).mockResolvedValue(
      maintenances,
    );

    const result = await resolver.getMaintenancesByAircraft(1);

    expect(maintenanceService.findAllByAircraft).toHaveBeenCalledWith(1);
    expect(result).toEqual(maintenances);
  });

  it('should find all maintenances', async () => {
    const maintenances = [{ id: 1 }, { id: 2 }];

    (maintenanceService.findAll as jest.Mock).mockResolvedValue(maintenances);

    const result = await resolver.getAllMaintenances();

    expect(maintenanceService.findAll).toHaveBeenCalled();
    expect(result).toEqual(maintenances);
  });
});
