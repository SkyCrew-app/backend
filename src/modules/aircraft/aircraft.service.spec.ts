import { Test, TestingModule } from '@nestjs/testing';
import { AircraftService } from './aircraft.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Aircraft } from './entity/aircraft.entity';
import { Repository } from 'typeorm';

describe('AircraftService', () => {
  let service: AircraftService;
  let repository: Repository<Aircraft>;

  const mockAircraftRepository = {
    find: jest
      .fn()
      .mockResolvedValue([
        { id: 1, registration_number: 'I-MNOP', model: 'Bonanza' },
      ]),
    findOne: jest.fn().mockResolvedValue({
      id: 1,
      registration_number: 'I-MNOP',
      model: 'Bonanza',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AircraftService,
        {
          provide: getRepositoryToken(Aircraft),
          useValue: mockAircraftRepository,
        },
      ],
    }).compile();

    service = module.get<AircraftService>(AircraftService);
    repository = module.get<Repository<Aircraft>>(getRepositoryToken(Aircraft));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return a list of aircraft', async () => {
    const result = await service.findAll();
    expect(result).toEqual([
      { id: 1, registration_number: 'I-MNOP', model: 'Bonanza' },
    ]);
  });

  it('should return a single aircraft by ID', async () => {
    const result = await service.findOne(1);
    expect(result).toEqual({
      id: 1,
      registration_number: 'I-MNOP',
      model: 'Bonanza',
    });
    expect(mockAircraftRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });
});
