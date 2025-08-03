import { Test, TestingModule } from '@nestjs/testing';
import { AdministrationModule } from '../administration.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Administration } from '../entity/admin.entity';
import { User } from '../../users/entity/users.entity';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { Reservation } from '../../reservations/entity/reservations.entity';
import { Flight } from '../../flights/entity/flights.entity';
import { Incident } from '../../incidents/entity/incidents.entity';

describe('AdministrationModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AdministrationModule],
    })
      // Mock repository providers for all entities to satisfy forFeature
      .overrideProvider(getRepositoryToken(Administration))
      .useValue({})
      .overrideProvider(getRepositoryToken(User))
      .useValue({})
      .overrideProvider(getRepositoryToken(Aircraft))
      .useValue({})
      .overrideProvider(getRepositoryToken(Reservation))
      .useValue({})
      .overrideProvider(getRepositoryToken(Flight))
      .useValue({})
      .overrideProvider(getRepositoryToken(Incident))
      .useValue({})
      .compile();
  });

  it('devrait compiler le module sans erreur', () => {
    expect(module).toBeDefined();
  });
});
