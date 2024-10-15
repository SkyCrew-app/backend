import { Test, TestingModule } from '@nestjs/testing';
import { AdministrationResolver } from './administration.resolver';

describe('AdministrationResolver', () => {
  let resolver: AdministrationResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdministrationResolver],
    }).compile();

    resolver = module.get<AdministrationResolver>(AdministrationResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
