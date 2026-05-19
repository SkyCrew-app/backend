/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsResolver } from '../reservations.resolver';
import { ReservationsService } from '../reservations.service';
import { CreateReservationInput } from '../dto/create-reservation.input';
import { UpdateReservationInput } from '../dto/update-reservation.input';
import { FlightCategory } from '../entity/reservations.entity';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';

describe('ReservationsResolver', () => {
  let resolver: ReservationsResolver;
  let service: ReservationsService;

  const mockService = {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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

      const result = await resolver.createReservation(createReservationInput);

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

      const result = await resolver.updateReservation(updateReservationInput);

      expect(mockService.update).toHaveBeenCalledWith(updateReservationInput);
      expect(result).toEqual(expectedReservation);
    });
  });

  describe('deleteReservation', () => {
    it('should delete a reservation and return true', async () => {
      const id = 1;
      mockService.delete.mockResolvedValue(undefined);

      const result = await resolver.deleteReservation(id);

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
});
