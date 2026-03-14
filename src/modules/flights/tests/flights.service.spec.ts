import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlightsService } from '../flights.service';
import { Flight } from '../entity/flights.entity';
import { Reservation } from '../../reservations/entity/reservations.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { AirportsService } from '../airports.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FlightPlanGeneratorService } from '../flight-plan-generator.service';
import { AircraftPerformanceService } from '../aircraft-performance.service';
import { MetarService } from '../metar.service';

describe('FlightsService', () => {
  let service: FlightsService;
  let repo: Partial<Record<keyof Repository<Flight>, jest.Mock>>;
  let resRepo: Partial<Record<keyof Repository<Reservation>, jest.Mock>>;
  let notif: Partial<NotificationsService>;
  let airports: Partial<AirportsService>;
  let generator: Partial<FlightPlanGeneratorService>;
  let perfService: Partial<AircraftPerformanceService>;
  let metar: Partial<MetarService>;

  beforeEach(async () => {
    repo = {
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
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
    it('creates and notifies', async () => {
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
      resRepo.findOne.mockResolvedValue({ id: 1 } as any);
      repo.save.mockResolvedValue({ id: 3, ...input, waypoints: '[]' });
      const res = await service.createFlightByUser(input as any);
      expect(notif.create).toHaveBeenCalledWith(
        expect.objectContaining({ notification_type: 'FLIGHT_CREATED' }),
      );
      expect(res).toEqual({ id: 3, ...input, waypoints: '[]' });
    });

    it('throws if reservation not found', async () => {
      resRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createFlightByUser({ reservation_id: 9, user_id: 2 } as any),
      ).rejects.toThrow(NotFoundException);
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

  describe('updateFlight', () => {
    it('updates and saves', async () => {
      repo.findOne.mockResolvedValue({ id: 7, waypoints: '[]' } as any);
      repo.save.mockResolvedValue({ id: 7 });
      const res = await service.updateFlight(7, {
        id: 7,
        origin_icao: 'XXX',
      } as any);
      expect(res).toEqual({ id: 7 });
    });
    it('throws if not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.updateFlight(8, { id: 8 } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeFlight', () => {
    it('deletes own flight', async () => {
      repo.findOne.mockResolvedValue({ id: 9, user: { id: 1 } } as any);
      repo.delete.mockResolvedValue({ affected: 1 } as any);
      expect(await service.removeFlight(9, 1)).toBe(true);
    });

    it('throws if flight not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.removeFlight(9, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if user does not own the flight', async () => {
      repo.findOne.mockResolvedValue({ id: 9, user: { id: 2 } } as any);
      await expect(service.removeFlight(9, 1)).rejects.toThrow(
        ForbiddenException,
      );
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
  });
});
