/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { AdministrationResolver } from '../administration.resolver';
import { AdministrationService } from '../administration.service';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Administration } from '../entity/admin.entity';

// Bypass Guards
jest.mock('@nestjs/common', () => {
  const original = jest.requireActual('@nestjs/common');
  return {
    ...original,
    UseGuards: () => (target: any, key?: any, descriptor?: any) => {},
  };
});

describe('AdministrationResolver', () => {
  let resolver: AdministrationResolver;
  let service: Partial<AdministrationService>;
  const adminSample: Administration = {
    id: 1,
    clubName: 'Club',
    contactEmail: '',
    contactPhone: '',
    address: '',
    closureDays: [],
    timeSlotDuration: 0,
    reservationStartTime: '',
    reservationEndTime: '',
    maintenanceDay: '',
    maintenanceDuration: 0,
    pilotLicenses: [],
    membershipFee: 0,
    flightHourRate: 0,
    clubRules: '',
    allowGuestPilots: false,
    guestPilotFee: 0,
    fuelManagement: 'self-service',
    isMaintenanceActive: false,
    maintenanceMessage: '',
    maintenanceTime: new Date(),
    taxonomies: null,
    fuelPrice: 0,
  } as Administration;

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([adminSample]),
      create: jest.fn().mockResolvedValue(adminSample),
      update: jest.fn().mockResolvedValue(adminSample),
      remove: jest.fn().mockResolvedValue(true),
      getMaintenance: jest.fn().mockResolvedValue(true),
      getMaintenanceDetails: jest.fn().mockResolvedValue({
        maintenanceTime: adminSample.maintenanceTime,
        maintenanceMessage: adminSample.maintenanceMessage,
      }),
      setMaintenance: jest.fn().mockResolvedValue(false),
      getAdminDashboardStats: jest.fn().mockResolvedValue({
        totalUsers: 1,
        totalAircrafts: 1,
        totalReservations: 1,
        totalFlights: 1,
        totalIncidents: 1,
        availableAircrafts: 1,
        pendingReservations: 1,
        flightHoursThisMonth: 1,
        usersByRole: [],
        reservationsByCategory: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdministrationResolver,
        { provide: AdministrationService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = module.get<AdministrationResolver>(AdministrationResolver);
  });

  it('findAll devrait appeler service.findAll', async () => {
    const result = await resolver.findAll();
    expect(service.findAll).toHaveBeenCalled();
    expect(result).toEqual([adminSample]);
  });

  it('create devrait appeler service.create', async () => {
    const input = {} as any;
    const result = await resolver.create(input);
    expect(service.create).toHaveBeenCalledWith(input);
    expect(result).toEqual(adminSample);
  });

  it('update devrait appeler service.update', async () => {
    const input = { id: 1 } as any;
    const result = await resolver.update(input);
    expect(service.update).toHaveBeenCalledWith(input.id, input);
    expect(result).toEqual(adminSample);
  });

  it('delete devrait appeler service.remove', async () => {
    const result = await resolver.delete(1);
    expect(service.remove).toHaveBeenCalledWith(1);
    expect(result).toBe(true);
  });

  it('getSiteStatus devrait appeler service.getMaintenance', async () => {
    const result = await resolver.getSiteStatus();
    expect(service.getMaintenance).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('getMaintenanceDetails devrait retourner un JSON stringifié', async () => {
    const result = await resolver.getMaintenanceDetails();
    expect(service.getMaintenanceDetails).toHaveBeenCalled();
    expect(result).toEqual(
      JSON.stringify({
        maintenanceTime: adminSample.maintenanceTime,
        maintenanceMessage: adminSample.maintenanceMessage,
      }),
    );
  });

  it('setSiteStatus devrait appeler service.setMaintenance', async () => {
    const result = await resolver.setSiteStatus();
    expect(service.setMaintenance).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('adminDashboardStats devrait appeler service.getAdminDashboardStats', async () => {
    const result = await resolver.adminDashboardStats();
    expect(service.getAdminDashboardStats).toHaveBeenCalled();
    expect(result).toEqual({
      totalUsers: 1,
      totalAircrafts: 1,
      totalReservations: 1,
      totalFlights: 1,
      totalIncidents: 1,
      availableAircrafts: 1,
      pendingReservations: 1,
      flightHoursThisMonth: 1,
      usersByRole: [],
      reservationsByCategory: [],
    });
  });
});
