import { Test, TestingModule } from '@nestjs/testing';
import { FlightsResolver } from '../flights.resolver';
import { FlightsService } from '../flights.service';
import { AirportsService } from '../airports.service';
import { Flight } from '../entity/flights.entity';

describe('FlightsResolver', () => {
  let resolver: FlightsResolver;
  let service: any;
  let airports: any;

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
    airports = { fetchAirportInfo: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlightsResolver,
        { provide: FlightsService, useValue: service },
        { provide: AirportsService, useValue: airports },
      ],
    }).compile();

    resolver = module.get<FlightsResolver>(FlightsResolver);
  });

  it('findAll calls service', async () => {
    service.findAll.mockResolvedValue([]);
    expect(await resolver.findAll()).toEqual([]);
  });

  it('departure_airport_info returns JSON string', async () => {
    const flight = { origin_icao: 'AAA' } as Flight;
    airports.fetchAirportInfo.mockResolvedValue({ data: 1 });
    expect(await resolver.departure_airport_info(flight)).toBe(
      JSON.stringify({ data: 1 }),
    );
  });

  it('createFlight calls service', async () => {
    const input = {
      user_id: 1,
      flight_hours: 1,
      flight_type: 'T',
      origin_icao: 'A',
      destination_icao: 'B',
      number_of_passengers: 1,
      waypoints: [],
    };
    service.createFlightByUser.mockResolvedValue({ id: 2 });
    expect(await resolver.createFlight(input as any)).toEqual({ id: 2 });
  });

  it('generateFlightPlan calls AI', async () => {
    service.createFlightByAI.mockResolvedValue({ id: 3 });
    expect(await resolver.generateFlightPlan('A', 'B', 1, 4)).toEqual({
      id: 3,
    });
  });

  it('removeFlight returns boolean', async () => {
    service.removeFlight.mockResolvedValue(true);
    expect(await resolver.removeFlight(5)).toBe(true);
  });

  it('getRecentFlights calls service', async () => {
    service.getRecentFlights.mockResolvedValue([{ id: 6 }]);
    expect(await resolver.getRecentFlights(1)).toEqual([{ id: 6 }]);
  });
});
