import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesResolver } from './expenses.resolver';

describe('ExpensesResolver', () => {
  let resolver: ExpensesResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExpensesResolver],
    }).compile();

    resolver = module.get<ExpensesResolver>(ExpensesResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
