import { Test, TestingModule } from '@nestjs/testing';
import { LicensesResolver } from './licenses.resolver';

describe('LicensesResolver', () => {
  let resolver: LicensesResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LicensesResolver],
    }).compile();

    resolver = module.get<LicensesResolver>(LicensesResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
