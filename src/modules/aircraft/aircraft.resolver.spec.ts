import { Test, TestingModule } from '@nestjs/testing';
import { AircraftResolver } from './aircraft.resolver';

describe('AircraftResolver', () => {
  let resolver: AircraftResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AircraftResolver],
    }).compile();

    resolver = module.get<AircraftResolver>(AircraftResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
