import { ForbiddenException, NotFoundException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsResolver } from '../reservations.resolver';
import { ReservationsService } from '../reservations.service';
import { CreateReservationInput } from '../dto/create-reservation.input';
import { UpdateReservationInput } from '../dto/update-reservation.input';
import { FlightCategory } from '../entity/reservations.entity';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';

const admin = {
  id: 1,
  email: 'admin@example.com',
  role: { role_name: 'Administrateur' },
} as any;
const holder = {
  id: 3,
  email: 'holder@example.com',
  role: { role_name: 'Pilote' },
} as any;
const stranger = {
  id: 7,
  email: 'stranger@example.com',
  role: { role_name: 'Pilote' },
} as any;

describe('ReservationsResolver', () => {
  let resolver: ReservationsResolver;
  let service: ReservationsService;

  const mockService = {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findOwnerId: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findFilteredReservations: jest.fn(),
    findUserReservations: jest.fn(),
    findRecentReservations: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsResolver,
        {
          provide: ReservationsService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = module.get<ReservationsResolver>(ReservationsResolver);
    service = module.get<ReservationsService>(ReservationsService);
  });

  beforeEach(() => {
    // By default the reservation exists and is held by user 3.
    mockService.findOwnerId.mockResolvedValue(3);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('createReservation', () => {
    it('should create a reservation', async () => {
      const createReservationInput: CreateReservationInput = {
        aircraft_id: 1,
        user_id: 1,
        start_time: new Date('2023-06-01T08:00:00Z'),
        end_time: new Date('2023-06-01T10:00:00Z'),
        flight_category: FlightCategory.LOCAL,
        reservation_date: new Date('2023-05-25'),
      };

      const expectedReservation = { id: 1, ...createReservationInput };
      mockService.create.mockResolvedValue(expectedReservation);

      const result = await resolver.createReservation(
        createReservationInput,
        admin,
      );

      expect(mockService.create).toHaveBeenCalledWith(createReservationInput);
      expect(result).toEqual(expectedReservation);
    });
  });

  describe('updateReservation', () => {
    it('should update a reservation', async () => {
      const updateReservationInput: UpdateReservationInput = {
        id: 1,
        flight_category: FlightCategory.INSTRUCTION,
        notes: 'Updated notes',
      };

      const expectedReservation = { id: 1, ...updateReservationInput };
      mockService.update.mockResolvedValue(expectedReservation);

      const result = await resolver.updateReservation(
        updateReservationInput,
        admin,
      );

      expect(mockService.update).toHaveBeenCalledWith(updateReservationInput);
      expect(result).toEqual(expectedReservation);
    });
  });

  describe('deleteReservation', () => {
    it('should delete a reservation and return true', async () => {
      const id = 1;
      mockService.delete.mockResolvedValue(undefined);

      const result = await resolver.deleteReservation(id, admin);

      expect(mockService.delete).toHaveBeenCalledWith(id);
      expect(result).toBe(true);
    });
  });

  describe('findAll', () => {
    it('should return all reservations', async () => {
      const expectedReservations = [
        { id: 1, aircraft_id: 1 },
        { id: 2, aircraft_id: 2 },
      ];

      mockService.findAll.mockResolvedValue(expectedReservations);

      const result = await resolver.findAll();

      expect(mockService.findAll).toHaveBeenCalled();
      expect(result).toEqual(expectedReservations);
    });
  });

  describe('findOne', () => {
    it('should return a reservation by id', async () => {
      const id = 1;
      const expectedReservation = { id, aircraft_id: 1 };

      mockService.findOne.mockResolvedValue(expectedReservation);

      const result = await resolver.findOne(id);

      expect(mockService.findOne).toHaveBeenCalledWith(id);
      expect(result).toEqual(expectedReservation);
    });
  });

  describe('getFilteredReservations', () => {
    it('should return filtered reservations', async () => {
      const startDate = '2023-06-01';
      const endDate = '2023-06-30';
      const expectedReservations = [{ id: 1 }];

      mockService.findFilteredReservations.mockResolvedValue(
        expectedReservations,
      );

      const result = await resolver.getFilteredReservations(startDate, endDate);

      expect(mockService.findFilteredReservations).toHaveBeenCalledWith(
        startDate,
        endDate,
      );
      expect(result).toEqual(expectedReservations);
    });

    it('should handle null date parameters', async () => {
      const expectedReservations = [{ id: 1 }];

      mockService.findFilteredReservations.mockResolvedValue(
        expectedReservations,
      );

      const result = await resolver.getFilteredReservations(null, null);

      expect(mockService.findFilteredReservations).toHaveBeenCalledWith(
        null,
        null,
      );
      expect(result).toEqual(expectedReservations);
    });
  });

  describe('getUserReservations', () => {
    it('should return reservations for a specific user', async () => {
      const userId = 1;
      const expectedReservations = [{ id: 1, user_id: userId }];

      mockService.findUserReservations.mockResolvedValue(expectedReservations);

      const result = await resolver.getUserReservations(userId);

      expect(mockService.findUserReservations).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedReservations);
    });
  });

  describe('getRecentReservations', () => {
    it('should return recent reservations with limit', async () => {
      const limit = 5;
      const expectedReservations = [{ id: 1 }, { id: 2 }];

      mockService.findRecentReservations.mockResolvedValue(
        expectedReservations,
      );

      const result = await resolver.getRecentReservations(limit);

      expect(mockService.findRecentReservations).toHaveBeenCalledWith(limit);
      expect(result).toEqual(expectedReservations);
    });
  });
  describe('authorization', () => {
    const input = {
      aircraft_id: 2,
      user_id: 3,
      start_time: new Date('2030-01-01T09:00:00Z'),
      end_time: new Date('2030-01-01T11:00:00Z'),
    } as any;

    it('books for the session user, whatever user id is sent', async () => {
      mockService.create.mockResolvedValue({ id: 1 });

      await resolver.createReservation(input, stranger);

      expect(mockService.create).toHaveBeenCalledWith({ ...input, user_id: 7 });
    });

    it('lets an administrator book for another user', async () => {
      mockService.create.mockResolvedValue({ id: 1 });

      await resolver.createReservation(input, admin);

      expect(mockService.create).toHaveBeenCalledWith(input);
    });

    it('refuses a member changing a reservation they do not hold', async () => {
      await expect(
        resolver.updateReservation({ id: 10, purpose: 'x' } as any, stranger),
      ).rejects.toThrow(ForbiddenException);
      expect(mockService.update).not.toHaveBeenCalled();
    });

    it('refuses a member cancelling a reservation they do not hold', async () => {
      await expect(resolver.deleteReservation(10, stranger)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockService.delete).not.toHaveBeenCalled();
    });

    it('lets the holder change and cancel their reservation', async () => {
      mockService.update.mockResolvedValue({ id: 10 });

      await resolver.updateReservation({ id: 10, purpose: 'x' } as any, holder);
      await expect(resolver.deleteReservation(10, holder)).resolves.toBe(true);

      expect(mockService.update).toHaveBeenCalledWith({ id: 10, purpose: 'x' });
      expect(mockService.delete).toHaveBeenCalledWith(10);
    });

    it('does not let the holder hand the reservation to someone else', async () => {
      mockService.update.mockResolvedValue({ id: 10 });

      await resolver.updateReservation({ id: 10, user_id: 7 } as any, holder);

      expect(mockService.update).toHaveBeenCalledWith({ id: 10 });
    });

    it('answers not found for an unknown reservation', async () => {
      mockService.findOwnerId.mockResolvedValue(null);

      await expect(resolver.deleteReservation(99, holder)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
