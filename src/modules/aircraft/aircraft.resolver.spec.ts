import { Test, TestingModule } from '@nestjs/testing';
import { AircraftResolver } from './aircraft.resolver';
import { AircraftService } from './aircraft.service';

describe('AircraftResolver', () => {
  let resolver: AircraftResolver;
  let aircraftService: AircraftService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AircraftResolver,
        {
          provide: AircraftService,
          useValue: {
            findAll: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    resolver = module.get<AircraftResolver>(AircraftResolver);
    aircraftService = module.get<AircraftService>(AircraftService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should get all aircrafts', async () => {
    const aircrafts = [
      {
        id: 1,
        registration_number: 'ABC123',
        model: 'Cessna 172',
        year_of_manufacture: 2020,
        availability_status: 'available',
        maintenance_status: 'none',
        hourly_cost: 120,
        image_url: null,
        documents_url: [],
        total_flight_hours: 100,
        reservations: [],
        maintenances: [],
      },
    ];

    jest.spyOn(aircraftService, 'findAll').mockResolvedValue(aircrafts);

    const result = await resolver.getAircrafts();

    expect(aircraftService.findAll).toHaveBeenCalled();
    expect(result).toEqual(aircrafts);
  });

  it('should create a new aircraft', async () => {
    const createAircraftInput = {
      registration_number: 'ABC123',
      model: 'Cessna 172',
      year_of_manufacture: 2020,
      availability_status: 'available',
      maintenance_status: 'none',
      hourly_cost: 120,
    };

    const newAircraft = {
      id: 1,
      ...createAircraftInput,
      image_url: null,
      documents_url: [],
      total_flight_hours: 0,
      reservations: [],
      maintenances: [],
    };

    jest.spyOn(aircraftService, 'create').mockResolvedValue(newAircraft);

    const result = await resolver.createAircraft(
      createAircraftInput,
      undefined,
      undefined,
    );

    expect(aircraftService.create).toHaveBeenCalledWith(
      createAircraftInput,
      [],
      null,
    );
    expect(result).toEqual(newAircraft);
  });

  it('should update an aircraft', async () => {
    const updateAircraftInput = {
      registration_number: 'ABC123',
      model: 'Cessna 172',
      year_of_manufacture: 2021,
      availability_status: 'available',
      maintenance_status: 'none',
      hourly_cost: 130,
    };

    const updatedAircraft = {
      id: 1,
      ...updateAircraftInput,
      image_url: null,
      documents_url: [],
      total_flight_hours: 120,
      reservations: [],
      maintenances: [],
    };

    jest.spyOn(aircraftService, 'update').mockResolvedValue(updatedAircraft);

    const result = await resolver.updateAircraft(
      1,
      updateAircraftInput,
      undefined,
      undefined,
    );

    expect(aircraftService.update).toHaveBeenCalledWith(
      1,
      updateAircraftInput,
      [],
      null,
    );
    expect(result).toEqual(updatedAircraft);
  });
});
