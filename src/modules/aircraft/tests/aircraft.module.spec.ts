import { Test, TestingModule } from '@nestjs/testing';
import { AircraftModule } from '../aircraft.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Aircraft } from '../entity/aircraft.entity';

describe('AircraftModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({ imports: [AircraftModule] })
      .overrideProvider(getRepositoryToken(Aircraft))
      .useValue({})
      .compile();
  });

  it('devrait compiler le module sans erreur', () => {
    expect(module).toBeDefined();
  });
});
