import { ForbiddenException, NotFoundException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsResolver } from '../reservations.resolver';
import { ReservationsService } from '../reservations.service';
import { FlightsService } from '../../flights/flights.service';
import { CreateReservationInput } from '../dto/create-reservation.input';
import { UpdateReservationInput } from '../dto/update-reservation.input';
import { FlightCategory } from '../entity/reservations.entity';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AdminActionsService } from '../../../common/admin-actions/admin-actions.service';
import { ADMIN_ACTION } from '../../../common/admin-actions/admin-actions';

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
    findCrewIds: jest.fn(),
    findInstructorReservations: jest.fn(),
    findBookableInstructors: jest.fn(),
    mayBookAlone: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findFilteredReservations: jest.fn(),
    findUserReservations: jest.fn(),
    findRecentReservations: jest.fn(),
  };

  const trace = { record: jest.fn() };

  // The real rule of the flights service, with one course on record: the
  // instructor 20 teaches the holder.
  const flightsService = new FlightsService(
    {
      manager: {
        count: jest.fn(async (_entity, { where }) =>
          where.instructor.id === 20 && where.student.id === holder.id ? 1 : 0,
        ),
      },
    } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsResolver,
        {
          provide: ReservationsService,
          useValue: mockService,
        },
        { provide: FlightsService, useValue: flightsService },
        { provide: AdminActionsService, useValue: trace },
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
    // Its instructor is user 20.
    mockService.findCrewIds.mockResolvedValue({ ownerId: 3, instructorId: 20 });
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

      expect(mockService.create).toHaveBeenCalledWith(
        createReservationInput,
        expect.any(Date),
        admin,
      );
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

      expect(mockService.delete).toHaveBeenCalledWith(id, {
        isAdmin: true,
        userId: admin.id,
      });
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

      expect(mockService.create).toHaveBeenCalledWith(
        { ...input, user_id: 7 },
        expect.any(Date),
        stranger,
      );
    });

    it('lets an administrator book for another user', async () => {
      mockService.create.mockResolvedValue({ id: 1 });

      await resolver.createReservation(input, admin);

      expect(mockService.create).toHaveBeenCalledWith(
        input,
        expect.any(Date),
        admin,
      );
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
      // The service is told the caller is not an administrator: it then
      // refuses a cancellation after the start time.
      expect(mockService.delete).toHaveBeenCalledWith(10, {
        isAdmin: false,
        userId: holder.id,
      });
    });

    // The instructor of a booking declines it; changing it stays the
    // holder's.
    it('lets the instructor of a booking cancel it, not change it', async () => {
      const itsInstructor = {
        id: 20,
        email: 'i@example.com',
        role: { role_name: 'Instructeur' },
      } as any;

      await expect(resolver.deleteReservation(10, itsInstructor)).resolves.toBe(
        true,
      );
      expect(mockService.delete).toHaveBeenCalledWith(10, {
        isAdmin: false,
        userId: 20,
      });

      await expect(
        resolver.updateReservation(
          { id: 10, purpose: 'x' } as any,
          itsInstructor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockService.update).not.toHaveBeenCalled();
    });

    it('refuses another instructor cancelling the booking', async () => {
      const another = {
        id: 21,
        email: 'j@example.com',
        role: { role_name: 'Instructeur' },
      } as any;

      await expect(resolver.deleteReservation(10, another)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockService.delete).not.toHaveBeenCalled();
    });

    it('lists the bookings the caller instructs, never someone else’s', async () => {
      mockService.findInstructorReservations.mockResolvedValue([{ id: 4 }]);

      await expect(
        resolver.getMyInstructionReservations(holder as any),
      ).resolves.toEqual([{ id: 4 }]);
      expect(mockService.findInstructorReservations).toHaveBeenCalledWith(
        holder.id,
      );
    });

    it('answers for the caller whether they may book without an instructor', async () => {
      mockService.mayBookAlone.mockResolvedValue(false);
      const until = new Date('2030-01-01T11:00:00Z');

      await expect(
        resolver.getMayBookWithoutInstructor(holder as any, until),
      ).resolves.toBe(false);
      expect(mockService.mayBookAlone).toHaveBeenCalledWith(holder.id, until);
    });

    it('does not let the holder hand the reservation to someone else', async () => {
      mockService.update.mockResolvedValue({ id: 10 });

      await resolver.updateReservation({ id: 10, user_id: 7 } as any, holder);

      expect(mockService.update).toHaveBeenCalledWith({ id: 10 });
    });

    it('answers not found for an unknown reservation', async () => {
      mockService.findCrewIds.mockResolvedValue(null);

      await expect(resolver.deleteReservation(99, holder)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // The schedule shows everyone's bookings; the flights attached to them
  // are the pilot's.
  describe('the flights of a booking', () => {
    const flights = [{ id: 1, closed_at: new Date(), flight_hours: 1.2 }];
    const booking = () => ({ id: 10, user: { id: holder.id }, flights }) as any;
    const instructor = (id: number) =>
      ({
        id,
        email: 'i@example.com',
        role: { role_name: 'Instructeur' },
      }) as any;

    it.each([
      ['the holder', holder],
      ['an administrator', admin],
      ['an instructor who teaches the holder', instructor(20)],
    ])('are read by %s', async (_who, reader) => {
      await expect(resolver.flights(booking(), reader, {})).resolves.toBe(
        flights,
      );
    });

    it.each([
      ['another member', stranger],
      ['an instructor who does not teach the holder', instructor(21)],
      ['nobody', undefined],
    ])('come back empty for %s, without failing', async (_who, reader) => {
      await expect(resolver.flights(booking(), reader, {})).resolves.toEqual(
        [],
      );
    });

    // The instructor of a booking was on board: they read its flights, even
    // without any course with the pilot, and not those of the pilot's other
    // bookings.
    it('are read by the instructor of that booking only', async () => {
      const onBoard = instructor(21);
      const context = {};

      await expect(
        resolver.flights(
          { ...booking(), instructor: { id: 21 } },
          onBoard,
          context,
        ),
      ).resolves.toBe(flights);
      await expect(
        resolver.flights({ ...booking(), id: 11 }, onBoard, context),
      ).resolves.toEqual([]);
      await expect(
        resolver.flights(
          { ...booking(), id: 12, instructor: { id: 22 } },
          onBoard,
          context,
        ),
      ).resolves.toEqual([]);
    });

    it('asks once per pilot within a request', async () => {
      const context = {};
      const spy = jest.spyOn(flightsService, 'canReadFlightsOf');
      spy.mockClear();

      await resolver.flights(booking(), stranger, context);
      await resolver.flights({ ...booking(), id: 11 }, stranger, context);

      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });

  describe("administrators' action log", () => {
    const booking = {
      id: 10,
      user: { id: 3, first_name: 'Jean', last_name: 'Dupont' },
      aircraft: { registration_number: 'F-GABC' },
      start_time: new Date('2026-11-02T09:00:00Z'),
      end_time: new Date('2026-11-02T10:00:00Z'),
      charged_amount: 150,
    };

    beforeEach(() => {
      mockService.update.mockResolvedValue(booking);
      mockService.findOne.mockResolvedValue(booking);
      mockService.delete.mockResolvedValue(undefined);
    });

    it('records an administrator changing the booking of another member', async () => {
      await resolver.updateReservation({ id: 10, purpose: 'x' } as any, admin);

      expect(trace.record).toHaveBeenCalledWith(
        admin,
        ADMIN_ACTION.RESERVATION_CHANGED_FOR_MEMBER,
        { type: 'reservation', id: 10, label: 'F-GABC, Jean Dupont' },
        expect.objectContaining({ memberId: 3, start: booking.start_time }),
      );
    });

    it('records an administrator cancelling the booking of another member, with what was given back', async () => {
      await resolver.deleteReservation(10, admin);

      expect(trace.record).toHaveBeenCalledWith(
        admin,
        ADMIN_ACTION.RESERVATION_CANCELLED_FOR_MEMBER,
        { type: 'reservation', id: 10, label: 'F-GABC, Jean Dupont' },
        expect.objectContaining({ memberId: 3, refundedAmount: 150 }),
      );
    });

    it('records nothing for the holder, the instructor who declines, or an administrator on their own booking', async () => {
      await resolver.updateReservation({ id: 10, purpose: 'x' } as any, holder);
      await resolver.deleteReservation(10, holder);
      await resolver.deleteReservation(10, {
        id: 20,
        role: { role_name: 'Instructeur' },
      } as any);

      mockService.findOwnerId.mockResolvedValue(admin.id);
      mockService.findCrewIds.mockResolvedValue({
        ownerId: admin.id,
        instructorId: null,
      });
      await resolver.updateReservation({ id: 10, purpose: 'x' } as any, admin);
      await resolver.deleteReservation(10, admin);

      expect(trace.record).not.toHaveBeenCalled();
    });

    it('records nothing when the change or the cancellation is refused', async () => {
      mockService.update.mockRejectedValue(new ForbiddenException('non'));
      mockService.delete.mockRejectedValue(new ForbiddenException('non'));

      await expect(
        resolver.updateReservation({ id: 10 } as any, admin),
      ).rejects.toThrow('non');
      await expect(resolver.deleteReservation(10, admin)).rejects.toThrow(
        'non',
      );
      expect(trace.record).not.toHaveBeenCalled();
    });

    it('still cancels when the booking cannot be read for the trace', async () => {
      mockService.findOne.mockRejectedValue(new Error('lecture impossible'));

      await expect(resolver.deleteReservation(10, admin)).resolves.toBe(true);
      expect(mockService.delete).toHaveBeenCalled();
      expect(trace.record).toHaveBeenCalledWith(
        admin,
        ADMIN_ACTION.RESERVATION_CANCELLED_FOR_MEMBER,
        { type: 'reservation', id: 10, label: null },
        expect.objectContaining({ memberId: 3 }),
      );
    });
  });
});
