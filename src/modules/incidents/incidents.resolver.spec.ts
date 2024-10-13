import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsResolver } from './incidents.resolver';

describe('IncidentsResolver', () => {
  let resolver: IncidentsResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IncidentsResolver],
    }).compile();

    resolver = module.get<IncidentsResolver>(IncidentsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
