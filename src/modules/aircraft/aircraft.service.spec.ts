import { Test, TestingModule } from '@nestjs/testing';
import { AircraftService } from './aircraft.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Aircraft } from './entity/aircraft.entity';
import { AvailabilityStatus } from './entity/aircraft.entity';
import * as fs from 'fs';

jest.mock('fs');

describe('AircraftService', () => {
  let service: AircraftService;
  let repository: Repository<Aircraft>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AircraftService,
        {
          provide: getRepositoryToken(Aircraft),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<AircraftService>(AircraftService);
    repository = module.get<Repository<Aircraft>>(getRepositoryToken(Aircraft));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a new aircraft', async () => {
    const createAircraftInput = {
      registration_number: 'ABC123',
      model: 'Cessna 172',
      year_of_manufacture: 2020,
      availability_status: AvailabilityStatus.AVAILABLE,
      maintenance_status: 'none',
      hourly_cost: 120,
    };

    const savedAircraft = {
      id: 1,
      ...createAircraftInput,
      documents_url: [],
      image_url: null,
      total_flight_hours: 0,
      reservations: [],
      maintenances: [],
    };

    jest.spyOn(repository, 'create').mockReturnValue(savedAircraft as any);
    jest.spyOn(repository, 'save').mockResolvedValue(savedAircraft as any);
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);

    const result = await service.create(createAircraftInput, [], null);

    expect(repository.create).toHaveBeenCalledWith(createAircraftInput);
    expect(repository.save).toHaveBeenCalledWith(savedAircraft);
    expect(result).toEqual(savedAircraft);
  });

  it('should update an aircraft', async () => {
    const updateAircraftInput = {
      registration_number: 'ABC123',
      model: 'Cessna 172',
      year_of_manufacture: 2021,
      availability_status: AvailabilityStatus.AVAILABLE,
      maintenance_status: 'none',
      hourly_cost: 130,
    };

    const updatedAircraft = {
      id: 1,
      ...updateAircraftInput,
      documents_url: [],
      image_url: null,
      total_flight_hours: 120,
      reservations: [],
      maintenances: [],
    };

    jest
      .spyOn(repository, 'findOneOrFail')
      .mockResolvedValue(updatedAircraft as any);
    jest.spyOn(repository, 'save').mockResolvedValue(updatedAircraft as any);
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const result = await service.update(1, updateAircraftInput, [], null);

    expect(repository.findOneOrFail).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(repository.save).toHaveBeenCalledWith(updatedAircraft);
    expect(result).toEqual(updatedAircraft);
  });
});
