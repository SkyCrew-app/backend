import { Test, TestingModule } from '@nestjs/testing';
import { FlightsResolver } from '../flights.resolver';
import { FlightsService } from '../flights.service';
import { AirportsService } from '../airports.service';
import { MetarService } from '../metar.service';
import { Flight } from '../entity/flights.entity';

describe('FlightsResolver', () => {
  let resolver: FlightsResolver;
  let service: any;
  let airports: any;
  let metar: any;

  const mockContext = {
    req: { user: { id: 1, role: 'Pilote' } },
  };

  const adminContext = {
    req: { user: { id: 99, role: 'Administrateur' } },
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      getFlightsByUser: jest.fn(),
      createFlightByUser: jest.fn(),
      createFlightByAI: jest.fn(),
      updateFlight: jest.fn(),
      removeFlight: jest.fn(),
      getRecentFlights: jest.fn(),
      getDetailedWaypoints: jest.fn(),
    };
    airports = {
      getAirportInfo: jest.fn().mockReturnValue({
        icao: 'LFPG',
        iata: 'CDG',
        name: 'CDG Airport',
        city: 'Paris',
        country: 'FR',
        lat: 49.0097,
        lon: 2.5479,
        elevation_ft: 392,
        type: 'large_airport',
        continent: 'EU',
        runways: ['09L/27R'],
        runway_details: [
          {
            le_ident: '09L',
            he_ident: '27R',
            length_ft: 13829,
            width_ft: 148,
            surface: 'ASP',
            lighted: true,
          },
        ],
        frequencies: [
          { type: 'TWR', value: '119.250' },
          { type: 'ATIS', value: '127.250' },
        ],
      }),
    };
    metar = {
      fetchMetarSafe: jest.fn().mockResolvedValue({
        icaoId: 'LFPG',
        rawOb: 'METAR LFPG 011230Z 09012KT',
        temp: 15,
        dewp: 8,
        wdir: 90,
        wspd: 12,
        wgst: null,
        visib: 10,
        altim: 1013,
        fltcat: 'VFR',
        clouds: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlightsResolver,
        { provide: FlightsService, useValue: service },
        { provide: AirportsService, useValue: airports },
        { provide: MetarService, useValue: metar },
      ],
    }).compile();

    resolver = module.get<FlightsResolver>(FlightsResolver);
  });

  it('findAll calls service', async () => {
    service.findAll.mockResolvedValue([]);
    expect(await resolver.findAll()).toEqual([]);
  });

  it('departure_airport_info returns enriched JSON with ICAO, runways, frequencies, weather', async () => {
    const flight = { origin_icao: 'LFPG' } as Flight;
    const result = await resolver.departure_airport_info(flight);
    const parsed = JSON.parse(result!);

    expect(parsed.ICAO).toBe('LFPG');
    expect(parsed.name).toBe('CDG Airport');
    expect(parsed.elevation).toBe(392);

    // Runways transformed: ident, surface, length/width in meters
    expect(parsed.runways).toHaveLength(1);
    expect(parsed.runways[0].ident).toBe('09L/27R');
    expect(parsed.runways[0].surface).toBe('ASP');
    expect(parsed.runways[0].length).toBe(Math.round(13829 * 0.3048));
    expect(parsed.runways[0].width).toBe(Math.round(148 * 0.3048));

    // Frequencies transformed: name + Hz
    expect(parsed.frequencies).toHaveLength(2);
    expect(parsed.frequencies[0].name).toBe('TWR');
    expect(parsed.frequencies[0].frequency).toBe(119250000);

    // Weather from METAR
    expect(parsed.weather.METAR).toContain('METAR LFPG');
    expect(parsed.weather.fltcat).toBe('VFR');
    expect(parsed.weather.temp).toBe(15);
    expect(parsed.weather.wspd).toBe(12);
  });

  it('departure_airport_info returns null if airport not found', async () => {
    airports.getAirportInfo.mockImplementation(() => {
      throw new Error('Not found');
    });
    const flight = { origin_icao: 'ZZZZ' } as Flight;
    const result = await resolver.departure_airport_info(flight);
    expect(result).toBeNull();
  });

  it('departure_airport_info handles missing METAR gracefully', async () => {
    metar.fetchMetarSafe.mockResolvedValue(null);
    const flight = { origin_icao: 'LFPG' } as Flight;
    const result = await resolver.departure_airport_info(flight);
    const parsed = JSON.parse(result!);

    expect(parsed.weather.METAR).toBeNull();
    expect(parsed.weather.temp).toBeNull();
  });

  it('createFlight uses authenticated user id', async () => {
    const input = {
      user_id: 999,
      flight_hours: 1,
      flight_type: 'T',
      origin_icao: 'A',
      destination_icao: 'B',
      number_of_passengers: 1,
      waypoints: [],
    };
    service.createFlightByUser.mockResolvedValue({ id: 2 });
    await resolver.createFlight(input as any, mockContext);
    expect(service.createFlightByUser).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 1 }),
    );
  });

  it('generateFlightPlan extracts user_id from context and passes options', async () => {
    service.createFlightByAI.mockResolvedValue({ id: 3 });
    const input = {
      origin_icao: 'A',
      destination_icao: 'B',
      reservation_id: 4,
      preferred_runway_dep: '09L',
      cruise_altitude_ft: 25000,
    };
    await resolver.generateFlightPlan(input as any, mockContext);
    expect(service.createFlightByAI).toHaveBeenCalledWith(
      'A',
      'B',
      1,
      4,
      expect.objectContaining({
        preferred_runway_dep: '09L',
        cruise_altitude_ft: 25000,
      }),
    );
  });

  it('generateFlightPlan works with minimal input', async () => {
    service.createFlightByAI.mockResolvedValue({ id: 3 });
    const input = {
      origin_icao: 'A',
      destination_icao: 'B',
      reservation_id: 4,
    };
    await resolver.generateFlightPlan(input as any, mockContext);
    expect(service.createFlightByAI).toHaveBeenCalledWith(
      'A',
      'B',
      1,
      4,
      expect.objectContaining({}),
    );
  });

  it('removeFlight passes user id for ownership check', async () => {
    service.removeFlight.mockResolvedValue(true);
    await resolver.removeFlight(5, mockContext);
    expect(service.removeFlight).toHaveBeenCalledWith(5, 1);
  });

  it('getFlightsByUser defaults to authenticated user', async () => {
    service.getFlightsByUser.mockResolvedValue([]);
    await resolver.getFlightsByUser(undefined as any, mockContext);
    expect(service.getFlightsByUser).toHaveBeenCalledWith(1);
  });

  it('getFlightsByUser allows admin to query other users', async () => {
    service.getFlightsByUser.mockResolvedValue([]);
    await resolver.getFlightsByUser(5, adminContext);
    expect(service.getFlightsByUser).toHaveBeenCalledWith(5);
  });

  it('getFlightsByUser throws for non-admin querying other user', () => {
    expect(() => resolver.getFlightsByUser(999, mockContext)).toThrow(
      "Vous ne pouvez pas accéder aux vols d'un autre utilisateur",
    );
  });

  it('getRecentFlights calls service', async () => {
    service.getRecentFlights.mockResolvedValue([{ id: 6 }]);
    expect(await resolver.getRecentFlights(1)).toEqual([{ id: 6 }]);
  });
});
