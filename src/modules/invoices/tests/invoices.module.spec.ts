import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InvoicesModule } from '../invoices.module';
import { InvoicesService } from '../invoices.service';
import { InvoicesResolver } from '../invoices.resolver';
import { Invoice } from '../entity/invoices.entity';

describe('InvoicesModule', () => {
  let module: TestingModule;
  let invoicesService: InvoicesService;
  let invoicesResolver: InvoicesResolver;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [InvoicesModule],
    })
      .overrideProvider(getRepositoryToken(Invoice))
      .useValue({}) // mock du repository
      .compile();

    invoicesService = module.get<InvoicesService>(InvoicesService);
    invoicesResolver = module.get<InvoicesResolver>(InvoicesResolver);
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should provide InvoicesService', () => {
    expect(invoicesService).toBeDefined();
  });

  it('should provide InvoicesResolver', () => {
    expect(invoicesResolver).toBeDefined();
  });
});
