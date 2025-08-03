import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceResolver } from '../maintenance.resolver';
import { MaintenanceService } from '../maintenance.service';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Reflector } from '@nestjs/core';

const mockService = {
  create: jest.fn(),
  update: jest.fn(),
  findOne: jest.fn(),
  findAllByAircraft: jest.fn(),
  findAll: jest.fn(),
};

describe('MaintenanceResolver', () => {
  let resolver: MaintenanceResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceResolver,
        { provide: MaintenanceService, useValue: mockService },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = module.get<MaintenanceResolver>(MaintenanceResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('createMaintenance', () => {
    it('forwards to service.create without files/images', async () => {
      const input = { aircraft_id: 1 } as any;
      mockService.create.mockResolvedValue({ id: 10 });
      const result = await resolver.createMaintenance(input, [], []);
      expect(mockService.create).toHaveBeenCalledWith(input, [], []);
      expect(result).toEqual({ id: 10 });
    });
  });

  describe('updateMaintenance', () => {
    it('forwards to service.update without files/images', async () => {
      const input = { id: 5 } as any;
      mockService.update.mockResolvedValue({ id: 5 });
      const result = await resolver.updateMaintenance(input, [], []);
      expect(mockService.update).toHaveBeenCalledWith(input, [], []);
      expect(result).toEqual({ id: 5 });
    });
  });

  describe('getMaintenance', () => {
    it('calls service.findOne', async () => {
      mockService.findOne.mockResolvedValue({ id: 3 });
      expect(await resolver.getMaintenance(3)).toEqual({ id: 3 });
      expect(mockService.findOne).toHaveBeenCalledWith(3);
    });
  });

  describe('getMaintenancesByAircraft', () => {
    it('calls service.findAllByAircraft', async () => {
      mockService.findAllByAircraft.mockResolvedValue([{ id: 2 }]);
      expect(await resolver.getMaintenancesByAircraft(2)).toEqual([{ id: 2 }]);
      expect(mockService.findAllByAircraft).toHaveBeenCalledWith(2);
    });
  });

  describe('getAllMaintenances', () => {
    it('calls service.findAll', async () => {
      mockService.findAll.mockResolvedValue([{ id: 1 }]);
      expect(await resolver.getAllMaintenances()).toEqual([{ id: 1 }]);
      expect(mockService.findAll).toHaveBeenCalled();
    });
  });
});
