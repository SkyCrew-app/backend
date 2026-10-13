import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlightsService } from '../flights.service';
import { Flight } from '../entity/flights.entity';
import { Reservation } from '../../reservations/entity/reservations.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { AirportsService } from '../airports.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { FlightPlanGeneratorService } from '../flight-plan-generator.service';
import { AircraftPerformanceService } from '../aircraft-performance.service';
import { MetarService } from '../metar.service';
import { User } from '../../users/entity/users.entity';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { FlightAmendment } from '../entity/flight-amendment.entity';
import { MAX_FLIGHT_HOURS } from '../flight-rules';

describe('FlightsService', () => {
  let service: FlightsService;
  let repo: Partial<Record<keyof Repository<Flight>, jest.Mock>>;
  let resRepo: Partial<Record<keyof Repository<Reservation>, jest.Mock>>;
  let notif: Partial<NotificationsService>;
  let airports: Partial<AirportsService>;
  let generator: Partial<FlightPlanGeneratorService>;
  let perfService: Partial<AircraftPerformanceService>;
  let metar: Partial<MetarService>;
  let manager: Record<string, jest.Mock>;

  beforeEach(async () => {
    manager = {
      increment: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn(async (_entity, value) => value),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn(),
    };
    manager.transaction = jest.fn(async (work) => work(manager));
    repo = {
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      manager: manager as any,
    };
    resRepo = { findOne: jest.fn(), find: jest.fn() };
    notif = { create: jest.fn() };
    airports = { getAirportInfo: jest.fn() };
    generator = { generateFlightPlan: jest.fn() };
    perfService = {
      getProfile: jest.fn().mockReturnValue({
        icao_type: 'C172',
        category: 'SEP',
        climb: { rate_fpm: 730, ias_kts: 75, fuel_lph: 38 },
        cruise: { tas_kts: 122, fuel_lph: 32, ceiling_ft: 14000 },
        descent: { rate_fpm: 500, ias_kts: 100, fuel_lph: 20 },
        approach: { ias_kts: 65, vref_kts: 60, fuel_lph: 25 },
        taxi_fuel_liters: 5,
        usable_fuel_liters: 200,
        max_range_nm: 640,
      }),
    };
    metar = { fetchMetarSafe: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlightsService,
        { provide: getRepositoryToken(Flight), useValue: repo },
        { provide: getRepositoryToken(Reservation), useValue: resRepo },
        { provide: NotificationsService, useValue: notif },
        { provide: AirportsService, useValue: airports },
        { provide: FlightPlanGeneratorService, useValue: generator },
        { provide: AircraftPerformanceService, useValue: perfService },
        { provide: MetarService, useValue: metar },
      ],
    }).compile();

    service = module.get<FlightsService>(FlightsService);
  });

  describe('createFlightByUser', () => {
    const pilot = { id: 2, email: 'p@example.com', role: 'Pilote' };
    const admin = { id: 1, email: 'a@example.com', role: 'Administrateur' };
    const input = {
      reservation_id: 1,
      user_id: 2,
      origin_icao: 'AAA',
      destination_icao: 'BBB',
      flight_hours: 1,
      flight_type: 'X',
      number_of_passengers: 1,
      waypoints: [],
    };

    beforeEach(() => {
      repo.save.mockImplementation(async (flight) => ({ id: 3, ...flight }));
    });

    it('creates and notifies', async () => {
      resRepo.findOne.mockResolvedValue({ id: 1, user: { id: 2 } } as any);
      const res = await service.createFlightByUser(input as any, pilot);
      expect(notif.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_type: 'FLIGHT_CREATED',
          user_id: 2,
        }),
      );
      expect(res).toMatchObject({
        id: 3,
        reservation: { id: 1 },
        user: { id: 2 },
        waypoints: '[]',
      });
    });

    it('records the instructor of the booking on the flight', async () => {
      resRepo.findOne.mockResolvedValue({
        id: 1,
        user: { id: 2 },
        instructor: { id: 8, first_name: 'Irene' },
      } as any);

      const res = await service.createFlightByUser(input as any, pilot);

      expect(res.instructor).toEqual({ id: 8 });
      expect(resRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: expect.arrayContaining(['instructor']),
        }),
      );
    });

    it('throws if reservation not found', async () => {
      resRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createFlightByUser(
          { reservation_id: 9, user_id: 2 } as any,
          pilot,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("refuses a flight on another member's booking", async () => {
      resRepo.findOne.mockResolvedValue({ id: 1, user: { id: 8 } } as any);

      await expect(
        service.createFlightByUser(input as any, pilot),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('refuses a flight on a cancelled booking', async () => {
      resRepo.findOne.mockResolvedValue({
        id: 1,
        user: { id: 2 },
        status: 'cancelled',
      } as any);

      await expect(
        service.createFlightByUser(input as any, pilot),
      ).rejects.toThrow(ConflictException);
    });

    it('refuses a member creating a flight without a booking', async () => {
      await expect(
        service.createFlightByUser(
          { ...input, reservation_id: undefined } as any,
          pilot,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('lets an administrator record a flight without a booking', async () => {
      const res = await service.createFlightByUser(
        { ...input, reservation_id: undefined } as any,
        admin,
      );

      expect(res).toMatchObject({ reservation: null, user: { id: 1 } });
    });

    it("gives the flight to the holder when an administrator uses a member's booking", async () => {
      resRepo.findOne.mockResolvedValue({ id: 1, user: { id: 8 } } as any);

      const res = await service.createFlightByUser(input as any, admin);

      expect(res).toMatchObject({ user: { id: 8 } });
    });

    it.each([
      ['a negative duration', { flight_hours: -1 }],
      ['a duration over the maximum', { flight_hours: MAX_FLIGHT_HOURS + 1 }],
      [
        'an arrival before the departure',
        {
          departure_time: new Date('2026-10-01T10:00:00Z'),
          arrival_time: new Date('2026-10-01T09:00:00Z'),
        },
      ],
    ])('refuses %s', async (_label, values) => {
      resRepo.findOne.mockResolvedValue({ id: 1, user: { id: 2 } } as any);

      await expect(
        service.createFlightByUser({ ...input, ...values } as any, pilot),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('createFlightByAI', () => {
    const mockAirport = {
      icao: 'LFPG',
      lat: 49,
      lon: 2,
      elevation_ft: 392,
      name: 'CDG',
      city: 'Paris',
      country: 'FR',
      type: 'large_airport',
      iata: 'CDG',
      continent: 'EU',
    };

    const setupMocks = () => {
      resRepo.findOne.mockResolvedValue({
        id: 1,
        aircraft: {
          cruiseSpeed: 500,
          maxAltitude: 30000,
          consumption: 40,
          model: 'Cessna 172',
        },
        flight_category: 'local',
        number_of_passengers: 1,
        start_time: new Date('2025-06-15T08:00:00Z'),
      });
      (airports.getAirportInfo as jest.Mock).mockReturnValue(mockAirport);
      (generator.generateFlightPlan as jest.Mock).mockReturnValue({
        distance_km: 600,
        flight_hours: 1.2,
        waypoints: [],
        encoded_polyline: '',
      });
      (metar.fetchMetarSafe as jest.Mock).mockResolvedValue(null);
      repo.create.mockReturnValue({ id: 10 });
      repo.save.mockResolvedValue({ id: 10 });
    };

    it("refuses a plan generated on another member's booking", async () => {
      setupMocks();
      resRepo.findOne.mockResolvedValue({ id: 1, user: { id: 8 } });

      await expect(
        service.createFlightByAI('LFPG', 'EGLL', 2, 1, {
          requester: { id: 2, email: 'p@example.com', role: 'Pilote' },
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('sends FLIGHT_CREATED notification', async () => {
      setupMocks();
      await service.createFlightByAI('LFPG', 'LFBO', 2, 1);

      expect(notif.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_type: 'FLIGHT_CREATED',
          user_id: 2,
        }),
      );
    });

    it('populates estimated_flight_time', async () => {
      setupMocks();
      await service.createFlightByAI('LFPG', 'LFBO', 2, 1);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          estimated_flight_time: expect.any(Number),
        }),
      );
    });

    it('populates departure_time and arrival_time', async () => {
      setupMocks();
      await service.createFlightByAI('LFPG', 'LFBO', 2, 1);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          departure_time: expect.any(Date),
          arrival_time: expect.any(Date),
        }),
      );

      const createCall = repo.create.mock.calls[0][0];
      expect(createCall.arrival_time.getTime()).toBeGreaterThan(
        createCall.departure_time.getTime(),
      );
    });

    it('uses requested departure_time from options', async () => {
      setupMocks();
      const customTime = new Date('2025-07-20T14:00:00Z');
      await service.createFlightByAI('LFPG', 'LFBO', 2, 1, {
        departure_time: customTime,
      });

      const createCall = repo.create.mock.calls[0][0];
      expect(createCall.departure_time).toEqual(customTime);
    });

    it('passes options to the flight plan generator', async () => {
      setupMocks();
      await service.createFlightByAI('LFPG', 'LFBO', 2, 1, {
        preferred_runway_dep: '09L',
        cruise_altitude_ft: 25000,
        flight_rules: 'IFR',
      });

      expect(generator.generateFlightPlan).toHaveBeenCalledWith(
        mockAirport,
        mockAirport,
        500,
        30000,
        'local',
        40,
        expect.objectContaining({
          preferred_runway_dep: '09L',
          cruise_altitude_ft: 25000,
          flight_rules: 'IFR',
        }),
      );
    });

    it('fetches METAR for both airports', async () => {
      setupMocks();
      await service.createFlightByAI('LFPG', 'LFBO', 2, 1);

      expect(metar.fetchMetarSafe).toHaveBeenCalledWith('LFPG');
      expect(metar.fetchMetarSafe).toHaveBeenCalledWith('LFBO');
    });

    it('passes METAR data to generator options', async () => {
      setupMocks();
      const metarData = {
        icaoId: 'LFPG',
        rawOb: 'METAR LFPG 09012KT',
        temp: 15,
        dewp: 8,
        wdir: 90,
        wspd: 12,
        wgst: null,
        visib: 10,
        altim: 1013,
        fltcat: 'VFR',
        clouds: [],
      };
      (metar.fetchMetarSafe as jest.Mock).mockResolvedValue(metarData);

      await service.createFlightByAI('LFPG', 'LFBO', 2, 1);

      expect(generator.generateFlightPlan).toHaveBeenCalledWith(
        mockAirport,
        mockAirport,
        500,
        30000,
        'local',
        40,
        expect.objectContaining({
          metar_departure: metarData,
          metar_arrival: metarData,
        }),
      );
    });

    it('passes flight category and consumption to generator', async () => {
      resRepo.findOne.mockResolvedValue({
        id: 1,
        aircraft: {
          cruiseSpeed: 500,
          maxAltitude: 30000,
          consumption: 35,
          model: 'Cessna 172',
        },
        flight_category: 'cross_country',
        number_of_passengers: 2,
        start_time: new Date('2025-06-15T08:00:00Z'),
      });
      (airports.getAirportInfo as jest.Mock).mockReturnValue(mockAirport);
      (generator.generateFlightPlan as jest.Mock).mockReturnValue({
        distance_km: 600,
        flight_hours: 1.2,
        waypoints: [],
        encoded_polyline: '',
      });
      (metar.fetchMetarSafe as jest.Mock).mockResolvedValue(null);
      repo.create.mockReturnValue({ id: 11 });
      repo.save.mockResolvedValue({ id: 11 });

      await service.createFlightByAI('LFPG', 'LFBO', 2, 1);

      expect(generator.generateFlightPlan).toHaveBeenCalledWith(
        mockAirport,
        mockAirport,
        500,
        30000,
        'cross_country',
        35,
        expect.any(Object),
      );
    });
  });

  describe('computeFlightTime', () => {
    it('calculates correctly', () => {
      expect(service.computeFlightTime(100, 50)).toBe(2);
    });
    it('throws on zero speed', () => {
      expect(() => service.computeFlightTime(100, 0)).toThrow(
        'Cruise speed must be greater than 0',
      );
    });
  });

  describe('findOne', () => {
    it('returns flight if found', async () => {
      repo.findOne.mockResolvedValue({ id: 5 } as any);
      expect(await service.findOne(5)).toEqual({ id: 5 });
    });
    it('throws if missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(6)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneFor', () => {
    const stored = { id: 5, user: { id: 3 } } as any;

    it.each([
      ['its pilot', { id: 3, email: 'p@example.com', role: 'Pilote' }],
      [
        'an administrator',
        {
          id: 1,
          email: 'a@example.com',
          role: { role_name: 'Administrateur' },
        },
      ],
    ])('gives the flight to %s', async (_label, caller) => {
      repo.findOne.mockResolvedValue(stored);

      await expect(service.findOneFor(5, caller as any)).resolves.toBe(stored);
    });

    it.each([
      ['another member', { id: 4, email: 'o@example.com', role: 'Pilote' }],
      ['an unknown caller', undefined],
    ])('refuses %s', async (_label, caller) => {
      repo.findOne.mockResolvedValue(stored);

      await expect(service.findOneFor(5, caller)).rejects.toThrow(
        ForbiddenException,
      );
    });

    // The instructor of the booking was on board: they read this flight
    // without any course with its pilot.
    it('gives the flight to the instructor of its booking, not to another instructor', async () => {
      const onBoard = { id: 8, email: 'i@example.com', role: 'Instructeur' };
      const another = { id: 9, email: 'j@example.com', role: 'Instructeur' };
      manager.count.mockResolvedValue(0);

      repo.findOne.mockResolvedValue({ ...stored, instructor: { id: 8 } });
      await expect(service.findOneFor(5, onBoard)).resolves.toMatchObject({
        id: 5,
      });
      await expect(service.findOneFor(5, another)).rejects.toThrow(
        ForbiddenException,
      );

      // A flight plan not yet closed: the instructor is on the booking.
      repo.findOne.mockResolvedValue({
        ...stored,
        reservation: { id: 40, instructor: { id: 8 } },
      });
      await expect(service.findOneFor(5, onBoard)).resolves.toMatchObject({
        id: 5,
      });
    });

    it('lets the instructor of one booking read that booking’s flights only', async () => {
      const onBoard = { id: 8, email: 'i@example.com', role: 'Instructeur' };
      manager.count.mockResolvedValue(0);

      await expect(service.canReadFlightsOf(3, onBoard, 8)).resolves.toBe(true);
      await expect(service.canReadFlightsOf(3, onBoard, null)).resolves.toBe(
        false,
      );
      await expect(service.canReadFlightsOf(3, onBoard, 9)).resolves.toBe(
        false,
      );
    });

    it('gives the flight to an instructor who teaches its pilot, not to another one', async () => {
      const instructor = { id: 6, email: 'i@example.com', role: 'Instructeur' };
      repo.findOne.mockResolvedValue(stored);

      manager.count.mockResolvedValue(1);
      await expect(service.findOneFor(5, instructor)).resolves.toBe(stored);
      expect(manager.count).toHaveBeenCalledWith(expect.anything(), {
        where: { instructor: { id: 6 }, student: { id: 3 } },
      });

      manager.count.mockResolvedValue(0);
      await expect(service.findOneFor(5, instructor)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateFlight', () => {
    const admin = { id: 1, email: 'a@example.com', role: 'Administrateur' };
    const owner = { id: 3, email: 'p@example.com', role: 'Pilote' };
    const other = { id: 4, email: 'o@example.com', role: 'Pilote' };
    const started = new Date(Date.now() - 2 * 3_600_000);
    const booking = () => ({
      id: 40,
      start_time: started,
      status: 'confirmed',
      user: { id: 3 },
      aircraft: { id: 12 },
    });
    const stored = (values: object = {}) =>
      ({
        id: 7,
        waypoints: '[]',
        flight_hours: 1,
        user: { id: 3 },
        reservation: booking(),
        ...values,
      }) as any;

    it('lets the pilot of the flight record what was flown', async () => {
      repo.findOne.mockResolvedValue(stored());

      const res = await service.updateFlight(
        7,
        { id: 7, flight_hours: 1.2 } as any,
        owner,
      );

      expect(res).toMatchObject({ id: 7, flight_hours: 1.2 });
    });

    it('does not let the pilot move the flight to someone else', async () => {
      repo.findOne.mockResolvedValue(stored());

      const res = await service.updateFlight(
        7,
        { id: 7, user_id: 4, reservation_id: 99, flight_hours: 2 } as any,
        owner,
      );

      expect(res).not.toHaveProperty('user_id');
      expect(res).not.toHaveProperty('reservation_id');
      expect(res).toMatchObject({
        flight_hours: 2,
        user: { id: 3 },
        reservation: { id: 40 },
      });
    });

    it.each([
      ['another member', other],
      ['an unknown caller', undefined],
    ])('refuses %s', async (_label, caller) => {
      repo.findOne.mockResolvedValue(stored());

      await expect(
        service.updateFlight(7, { id: 7, flight_hours: 9 } as any, caller),
      ).rejects.toThrow(ForbiddenException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    // This test used to assert that `user_id` was copied onto the flight as a
    // plain property, which the database ignores: the move was lost.
    it('lets an administrator move a flight to another member and booking', async () => {
      repo.findOne.mockResolvedValue(stored());
      manager.findOne.mockResolvedValue({ id: 4 });
      resRepo.findOne.mockResolvedValue({
        id: 41,
        user: { id: 4 },
        aircraft: { id: 13 },
      } as any);

      const res = await service.updateFlight(
        7,
        { id: 7, user_id: 4, reservation_id: 41, waypoints: ['A', 'B'] } as any,
        admin,
      );

      expect(res).toMatchObject({
        user: { id: 4 },
        reservation: { id: 41 },
        waypoints: '["A","B"]',
      });
      expect(res).not.toHaveProperty('user_id');
    });

    it('closes the flight when asked to', async () => {
      repo.findOne.mockResolvedValue(stored());

      const res = await service.updateFlight(
        7,
        { id: 7, flight_hours: 1.2, closed: true } as any,
        owner,
      );

      expect(res.closed_at).toBeInstanceOf(Date);
      expect(res).not.toHaveProperty('closed');
      // The hours flown join the pilot's total when the flight is closed…
      expect(manager.increment).toHaveBeenCalledWith(
        User,
        { id: 3 },
        'total_flight_hours',
        1.2,
      );
      // …and the total of the aircraft that was flown.
      expect(manager.increment).toHaveBeenCalledWith(
        Aircraft,
        { id: 12 },
        'total_flight_hours',
        1.2,
      );
      expect(manager.increment).toHaveBeenCalledTimes(2);
    });

    describe('on an instruction booking', () => {
      const withInstructor = (values: object = {}) =>
        stored({
          reservation: { ...booking(), instructor: { id: 8 } },
          ...values,
        });

      it('records the instructor when the flight is closed and counts the hours for both', async () => {
        repo.findOne.mockResolvedValue(withInstructor());

        const res = await service.updateFlight(
          7,
          { id: 7, flight_hours: 1.2, closed: true } as any,
          owner,
        );

        expect(res.instructor).toEqual({ id: 8 });
        // The student's total grows as on any flight…
        expect(manager.increment).toHaveBeenCalledWith(
          User,
          { id: 3 },
          'total_flight_hours',
          1.2,
        );
        // …the instructor was on board too…
        expect(manager.increment).toHaveBeenCalledWith(
          User,
          { id: 8 },
          'total_flight_hours',
          1.2,
        );
        // …and the aircraft flew once.
        expect(manager.increment).toHaveBeenCalledWith(
          Aircraft,
          { id: 12 },
          'total_flight_hours',
          1.2,
        );
        expect(manager.increment).toHaveBeenCalledTimes(3);
      });

      it('takes the instructor of the booking as it stands at closing', async () => {
        // Planned with instructor 8; the booking is now with instructor 9.
        repo.findOne.mockResolvedValue(
          withInstructor({
            instructor: { id: 8 },
            reservation: { ...booking(), instructor: { id: 9 } },
          }),
        );

        const res = await service.updateFlight(
          7,
          { id: 7, closed: true } as any,
          owner,
        );

        expect(res.instructor).toEqual({ id: 9 });
        expect(manager.increment).toHaveBeenCalledWith(
          User,
          { id: 9 },
          'total_flight_hours',
          1,
        );
        expect(manager.increment).not.toHaveBeenCalledWith(
          User,
          { id: 8 },
          'total_flight_hours',
          expect.anything(),
        );
      });

      it('amends the hours of a closed instruction flight for the student, the instructor and the aircraft', async () => {
        repo.findOne.mockResolvedValue(
          withInstructor({
            flight_hours: 1.5,
            closed_at: new Date(),
            instructor: { id: 8 },
          }),
        );

        await service.updateFlight(7, { id: 7, flight_hours: 2 } as any, admin);

        for (const [entity, id] of [
          [User, 3],
          [User, 8],
          [Aircraft, 12],
        ] as const) {
          expect(manager.increment).toHaveBeenCalledWith(
            entity,
            { id },
            'total_flight_hours',
            0.5,
          );
        }
        expect(manager.increment).toHaveBeenCalledTimes(3);
        expect(manager.save).toHaveBeenCalledWith(
          FlightAmendment,
          expect.objectContaining({
            before: expect.objectContaining({ instructor_id: 8 }),
            after: expect.objectContaining({ instructor_id: 8 }),
          }),
        );
      });

      it('moves the instructor’s hours when an administrator moves the flight to a booking without instructor', async () => {
        repo.findOne.mockResolvedValue(
          withInstructor({
            flight_hours: 1.5,
            closed_at: new Date(),
            instructor: { id: 8 },
          }),
        );
        resRepo.findOne.mockResolvedValue({
          id: 41,
          user: { id: 3 },
          aircraft: { id: 12 },
          instructor: null,
        } as any);

        const res = await service.updateFlight(
          7,
          { id: 7, reservation_id: 41 } as any,
          admin,
        );

        expect(res.instructor).toBeNull();
        // Only the instructor loses the hours: same pilot, same aircraft.
        expect(manager.increment.mock.calls).toEqual([
          [User, { id: 8 }, 'total_flight_hours', -1.5],
        ]);
      });
    });

    it('counts a flight closed twice at the same time only once', async () => {
      repo.findOne.mockResolvedValue(stored());
      // The other request closed it first.
      manager.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.updateFlight(7, { id: 7, closed: true } as any, owner),
      ).rejects.toThrow(ConflictException);
      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('leaves the flight open otherwise', async () => {
      repo.findOne.mockResolvedValue(stored());

      const res = await service.updateFlight(7, { id: 7 } as any, owner);

      expect(res.closed_at).toBeUndefined();
      expect(manager.increment).not.toHaveBeenCalled();
    });

    it.each([
      ['a negative duration', -50],
      ['an empty duration', 0],
      ['a duration over the maximum', MAX_FLIGHT_HOURS + 0.5],
    ])('refuses to close with %s', async (_label, hours) => {
      repo.findOne.mockResolvedValue(stored());

      await expect(
        service.updateFlight(
          7,
          { id: 7, flight_hours: hours, closed: true } as any,
          owner,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(manager.save).not.toHaveBeenCalled();
      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('refuses an arrival before the departure', async () => {
      repo.findOne.mockResolvedValue(
        stored({ departure_time: new Date('2026-10-01T10:00:00Z') }),
      );

      await expect(
        service.updateFlight(
          7,
          { id: 7, arrival_time: new Date('2026-10-01T09:30:00Z') } as any,
          owner,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses to close a flight before its booking has started', async () => {
      repo.findOne.mockResolvedValue(
        stored({
          reservation: {
            ...booking(),
            start_time: new Date(Date.now() + 3_600_000),
          },
        }),
      );

      await expect(
        service.updateFlight(7, { id: 7, closed: true } as any, owner),
      ).rejects.toThrow(ConflictException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it("refuses to close a flight attached to another member's booking", async () => {
      repo.findOne.mockResolvedValue(
        stored({ reservation: { ...booking(), user: { id: 8 } } }),
      );

      await expect(
        service.updateFlight(7, { id: 7, closed: true } as any, owner),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses a member closing a flight that has no booking, and lets an administrator', async () => {
      repo.findOne.mockResolvedValue(stored({ reservation: null }));
      await expect(
        service.updateFlight(7, { id: 7, closed: true } as any, owner),
      ).rejects.toThrow(ConflictException);

      repo.findOne.mockResolvedValue(stored({ reservation: null }));
      const res = await service.updateFlight(
        7,
        { id: 7, closed: true } as any,
        admin,
      );
      expect(res.closed_at).toBeInstanceOf(Date);
      // No aircraft to credit without a booking.
      expect(manager.increment).toHaveBeenCalledTimes(1);
    });

    it('refuses a pilot who changes a flight already closed', async () => {
      const closedAt = new Date('2026-10-01T10:00:00Z');
      repo.findOne.mockResolvedValue(stored({ closed_at: closedAt }));

      await expect(
        service.updateFlight(7, { id: 7, flight_hours: 9 } as any, owner),
      ).rejects.toThrow(ConflictException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('lets an administrator amend a closed flight without reopening it', async () => {
      const closedAt = new Date('2026-10-01T10:00:00Z');
      repo.findOne.mockResolvedValue(
        stored({ flight_hours: 1.5, closed_at: closedAt }),
      );

      const res = await service.updateFlight(
        7,
        { id: 7, flight_hours: 2, closed: true } as any,
        admin,
      );

      expect(res).toMatchObject({ flight_hours: 2, closed_at: closedAt });
      // Only the difference with what was already counted, for the member
      // and for the aircraft.
      expect(manager.increment).toHaveBeenCalledWith(
        User,
        { id: 3 },
        'total_flight_hours',
        0.5,
      );
      expect(manager.increment).toHaveBeenCalledWith(
        Aircraft,
        { id: 12 },
        'total_flight_hours',
        0.5,
      );
      // The amendment leaves a trace of what the flight said before.
      expect(manager.save).toHaveBeenCalledWith(
        FlightAmendment,
        expect.objectContaining({
          flight_id: 7,
          action: 'amended',
          actor_id: 1,
          before: expect.objectContaining({ flight_hours: 1.5 }),
          after: expect.objectContaining({ flight_hours: 2 }),
        }),
      );
    });

    it('moves the hours of a closed flight with it', async () => {
      repo.findOne.mockResolvedValue(
        stored({ flight_hours: 1.5, closed_at: new Date() }),
      );
      manager.findOne.mockResolvedValue({ id: 4 });

      await service.updateFlight(7, { id: 7, user_id: 4 } as any, admin);

      expect(manager.increment).toHaveBeenCalledWith(
        User,
        { id: 3 },
        'total_flight_hours',
        -1.5,
      );
      expect(manager.increment).toHaveBeenCalledWith(
        User,
        { id: 4 },
        'total_flight_hours',
        1.5,
      );
      // Same aircraft, same hours: nothing to change there.
      expect(manager.increment).toHaveBeenCalledTimes(2);
    });

    it('throws if not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.updateFlight(8, { id: 8 } as any, admin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportRecapPdf', () => {
    const stored = {
      id: 7,
      origin_icao: 'LFPO',
      destination_icao: 'LFPN',
      flight_type: 'local',
      flight_hours: 1,
      user: { id: 3, first_name: 'Jean', last_name: 'Dupont' },
    } as any;

    it.each([
      ['its pilot', { id: 3, email: 'p@example.com', role: 'Pilote' }],
      [
        'an administrator',
        { id: 1, email: 'a@example.com', role: 'Administrateur' },
      ],
    ])('gives the PDF to %s', async (_label, caller) => {
      repo.findOne.mockResolvedValue(stored);

      const base64 = await service.exportRecapPdf(7, caller);

      expect(Buffer.from(base64, 'base64').subarray(0, 5).toString()).toBe(
        '%PDF-',
      );
    });

    it('refuses another member', async () => {
      repo.findOne.mockResolvedValue(stored);

      await expect(
        service.exportRecapPdf(7, {
          id: 4,
          email: 'o@example.com',
          role: 'Pilote',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws if not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.exportRecapPdf(8)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeFlight', () => {
    const admin = { id: 1, email: 'a@example.com', role: 'Administrateur' };
    const owner = { id: 3, email: 'p@example.com', role: 'Pilote' };
    const open = () =>
      ({
        id: 9,
        flight_hours: 1.5,
        user: { id: 3 },
        reservation: { id: 40, aircraft: { id: 12 } },
      }) as any;
    const closed = () => ({ ...open(), closed_at: new Date() });

    it('deletes own flight plan', async () => {
      repo.findOne.mockResolvedValue(open());

      expect(await service.removeFlight(9, owner)).toBe(true);
      expect(manager.delete).toHaveBeenCalledWith(Flight, 9);
      // An open flight never counted in any total.
      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('throws if flight not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.removeFlight(9, owner)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if user does not own the flight', async () => {
      repo.findOne.mockResolvedValue({ ...open(), user: { id: 2 } });
      await expect(service.removeFlight(9, owner)).rejects.toThrow(
        ForbiddenException,
      );
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it('refuses the pilot deleting a closed flight', async () => {
      repo.findOne.mockResolvedValue(closed());

      await expect(service.removeFlight(9, owner)).rejects.toThrow(
        ConflictException,
      );
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it("lets an administrator delete a member's closed flight, takes the hours back and keeps a trace", async () => {
      repo.findOne.mockResolvedValue(closed());

      expect(
        await service.removeFlight(9, {
          ...admin,
          role: { role_name: 'Administrateur' },
        }),
      ).toBe(true);

      expect(manager.increment).toHaveBeenCalledWith(
        User,
        { id: 3 },
        'total_flight_hours',
        -1.5,
      );
      expect(manager.increment).toHaveBeenCalledWith(
        Aircraft,
        { id: 12 },
        'total_flight_hours',
        -1.5,
      );
      expect(manager.save).toHaveBeenCalledWith(
        FlightAmendment,
        expect.objectContaining({
          flight_id: 9,
          action: 'deleted',
          actor_id: 1,
          before: expect.objectContaining({ flight_hours: 1.5, user_id: 3 }),
        }),
      );
    });

    it('takes the hours of a deleted instruction flight back from the student, the instructor and the aircraft', async () => {
      repo.findOne.mockResolvedValue({ ...closed(), instructor: { id: 8 } });

      await service.removeFlight(9, {
        ...admin,
        role: { role_name: 'Administrateur' },
      });

      expect(manager.increment.mock.calls).toEqual([
        [User, { id: 3 }, 'total_flight_hours', -1.5],
        [User, { id: 8 }, 'total_flight_hours', -1.5],
        [Aircraft, { id: 12 }, 'total_flight_hours', -1.5],
      ]);
    });

    it('refuses to delete a flight an incident refers to', async () => {
      repo.findOne.mockResolvedValue(closed());
      manager.count.mockResolvedValue(1);

      await expect(service.removeFlight(9, admin)).rejects.toThrow(
        ConflictException,
      );
      expect(manager.delete).not.toHaveBeenCalled();
    });
  });

  describe('getDetailedWaypoints', () => {
    it('formats waypoints with phase and speed', async () => {
      const wpJson = JSON.stringify([
        {
          ident: 'I1',
          type: 'FIX',
          name: 'N',
          lat: 0,
          lon: 0,
          alt: 2000,
          phase: 'CRUISE',
          speed_kts: 270,
        },
      ]);
      const res = await service.getDetailedWaypoints(wpJson);
      expect(res[0]).toContain('I1');
      expect(res[0]).toContain('FIX');
      expect(res[0]).toContain('CRUISE');
      expect(res[0]).toContain('IAS: 270kt');
    });

    it('formats waypoints without phase/speed gracefully', async () => {
      const wpJson = JSON.stringify([
        { ident: 'I1', type: 'FIX', name: 'N', lat: 0, lon: 0, alt: 2000 },
      ]);
      const res = await service.getDetailedWaypoints(wpJson);
      expect(res[0]).toContain('I1 (FIX)');
    });
  });

  describe('getFlightsByUser & getRecentFlights', () => {
    it('delegates to repo.find', async () => {
      repo.find.mockResolvedValue([{ id: 1 }] as any);
      expect(await service.getFlightsByUser(1)).toEqual([{ id: 1 }]);
      expect(await service.getRecentFlights(2)).toEqual([{ id: 1 }]);
    });

    it('bounds the number of recent flights', async () => {
      repo.find.mockResolvedValue([]);

      await service.getRecentFlights(100000);
      expect(repo.find).toHaveBeenLastCalledWith(
        expect.objectContaining({ take: 50 }),
      );
      await service.getRecentFlights(-3);
      expect(repo.find).toHaveBeenLastCalledWith(
        expect.objectContaining({ take: 1 }),
      );
    });
  });
});
