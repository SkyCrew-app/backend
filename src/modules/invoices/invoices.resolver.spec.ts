import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesResolver } from './invoices.resolver';

describe('InvoicesResolver', () => {
  let resolver: InvoicesResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InvoicesResolver],
    }).compile();

    resolver = module.get<InvoicesResolver>(InvoicesResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
