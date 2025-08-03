import { Test, TestingModule } from '@nestjs/testing';
import { AdministrationService } from '../administration.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Administration } from '../entity/admin.entity';
import { User } from '../../users/entity/users.entity';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { Reservation } from '../../reservations/entity/reservations.entity';
import { Flight } from '../../flights/entity/flights.entity';
import { Incident } from '../../incidents/entity/incidents.entity';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

describe('AdministrationService', () => {
  let service: AdministrationService;
  let adminRepo: Partial<Repository<Administration>>;
  let userRepo: Partial<Repository<User>>;
  let aircraftRepo: Partial<Repository<Aircraft>>;
  let reservationRepo: Partial<Repository<Reservation>>;
  let flightRepo: Partial<Repository<Flight>>;
  let incidentRepo: Partial<Repository<Incident>>;

  beforeEach(async () => {
    adminRepo = {
      create: jest.fn().mockImplementation((dto) => dto as Administration),
      save: jest.fn().mockResolvedValue({ id: 1 } as Administration),
      find: jest.fn().mockResolvedValue([{ id: 1 }] as Administration[]),
      findOne: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    userRepo = { count: jest.fn().mockResolvedValue(2) };
    aircraftRepo = { count: jest.fn().mockResolvedValue(3) };
    reservationRepo = { count: jest.fn().mockResolvedValue(4) };
    flightRepo = {
      count: jest.fn().mockResolvedValue(5),
      createQueryBuilder: jest.fn(),
    };
    incidentRepo = { count: jest.fn().mockResolvedValue(6) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdministrationService,
        { provide: getRepositoryToken(Administration), useValue: adminRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Aircraft), useValue: aircraftRepo },
        { provide: getRepositoryToken(Reservation), useValue: reservationRepo },
        { provide: getRepositoryToken(Flight), useValue: flightRepo },
        { provide: getRepositoryToken(Incident), useValue: incidentRepo },
      ],
    }).compile();

    service = module.get<AdministrationService>(AdministrationService);
  });

  it('create devrait créer et sauvegarder', async () => {
    const dto = { clubName: 'Club' } as any;
    await expect(service.create(dto)).resolves.toEqual({ id: 1 });
    expect(adminRepo.create).toHaveBeenCalledWith(dto);
    expect(adminRepo.save).toHaveBeenCalled();
  });

  it('findAll devrait retourner la liste', async () => {
    await expect(service.findAll()).resolves.toEqual([{ id: 1 }]);
    expect(adminRepo.find).toHaveBeenCalled();
  });

  it('findOne devrait lancer NotFoundException si absent', async () => {
    (adminRepo.findOne as jest.Mock).mockResolvedValue(null);
    await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
  });

  it("findOne devrait retourner l'administration", async () => {
    (adminRepo.findOne as jest.Mock).mockResolvedValue({
      id: 1,
    } as Administration);
    await expect(service.findOne(1)).resolves.toEqual({ id: 1 });
  });

  it('update devrait fusionner et sauvegarder', async () => {
    (adminRepo.findOne as jest.Mock).mockResolvedValue({ id: 1 } as any);
    const dto = { clubName: 'New' } as any;
    await expect(service.update(1, dto)).resolves.toHaveProperty('id', 1);
    expect(adminRepo.save).toHaveBeenCalled();
  });

  it('remove devrait supprimer et renvoyer true', async () => {
    (adminRepo.findOne as jest.Mock).mockResolvedValue({ id: 1 } as any);
    await expect(service.remove(1)).resolves.toBe(true);
    expect(adminRepo.remove).toHaveBeenCalled();
  });

  it('getMaintenance devrait retourner le status', async () => {
    (adminRepo.findOne as jest.Mock).mockResolvedValue({
      isMaintenanceActive: true,
    } as any);
    await expect(service.getMaintenance()).resolves.toBe(true);
  });

  it('getMaintenanceDetails devrait lancer si absent', async () => {
    (adminRepo.findOne as jest.Mock).mockResolvedValue(null);
    await expect(service.getMaintenanceDetails()).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getMaintenanceDetails devrait retourner message et time', async () => {
    const admin = {
      maintenanceTime: new Date(),
      maintenanceMessage: 'msg',
    } as any;
    (adminRepo.findOne as jest.Mock).mockResolvedValue(admin);
    await expect(service.getMaintenanceDetails()).resolves.toEqual({
      maintenanceTime: admin.maintenanceTime,
      maintenanceMessage: 'msg',
    });
  });

  it('setMaintenance devrait toggler et sauvegarder', async () => {
    const admin = { isMaintenanceActive: false } as any;
    (adminRepo.findOne as jest.Mock).mockResolvedValue(admin);
    await expect(service.setMaintenance()).resolves.toBe(true);
    expect(adminRepo.save).toHaveBeenCalled();
  });

  it('getAdminDashboardStats devrait retourner les stats formatées', async () => {
    // mock counts
    (userRepo.count as jest.Mock).mockResolvedValue(2);
    (aircraftRepo.count as jest.Mock).mockResolvedValue(3);
    (reservationRepo.count as jest.Mock).mockResolvedValue(4);
    (flightRepo.count as jest.Mock).mockResolvedValue(5);
    (incidentRepo.count as jest.Mock).mockResolvedValue(6);
    // mock query builders for flight hours
    const flightQB = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ totalHours: 10 }),
    } as any;
    (flightRepo.createQueryBuilder as jest.Mock).mockReturnValue(flightQB);
    // mock query builder for users by role
    const userQB = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValue([{ roleId: 1, role_name: 'admin', count: '5' }]),
    } as any;
    (userRepo as any).createQueryBuilder = jest.fn().mockReturnValue(userQB);
    // mock query builder for reservations by category
    const resQB = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValue([{ flight_category: 'cat', count: '7' }]),
    } as any;
    (reservationRepo as any).createQueryBuilder = jest
      .fn()
      .mockReturnValue(resQB);

    const stats = await service.getAdminDashboardStats();
    expect(stats.totalUsers).toBe(2);
    expect(stats.availableAircrafts).toBe(3);
    expect(stats.flightHoursThisMonth).toBe(10);
    expect(stats.usersByRole[0]).toEqual({
      roleId: 1,
      role_name: 'admin',
      count: 5,
    });
  });
});
