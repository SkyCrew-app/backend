import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesResolver } from '../invoices.resolver';
import { InvoicesService } from '../invoices.service';
import { Invoice } from '../entity/invoices.entity';

describe('InvoicesResolver', () => {
  let resolver: InvoicesResolver;
  let service: Partial<Record<keyof InvoicesService, jest.Mock>>;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findByUser: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesResolver,
        { provide: InvoicesService, useValue: service },
      ],
    }).compile();

    resolver = module.get<InvoicesResolver>(InvoicesResolver);
  });

  it('createInvoice should call service.create', () => {
    const input = { user_id: 1 } as any;
    const invoice = {} as Invoice;
    (service.create as jest.Mock).mockReturnValue(invoice);
    expect(resolver.createInvoice(input)).toBe(invoice);
    expect(service.create).toHaveBeenCalledWith(input);
  });

  it('invoices query should return service.findAll', () => {
    const list = [] as Invoice[];
    (service.findAll as jest.Mock).mockReturnValue(list);
    expect(resolver.findAll()).toBe(list);
  });

  it('invoice query should return service.findOne', () => {
    const inv = {} as Invoice;
    (service.findOne as jest.Mock).mockReturnValue(inv);
    expect(resolver.findOne(2)).toBe(inv);
    expect(service.findOne).toHaveBeenCalledWith(2);
  });

  it('updateInvoice should call service.update', () => {
    const input = { id: 3 } as any;
    const inv = {} as Invoice;
    (service.update as jest.Mock).mockReturnValue(inv);
    expect(resolver.updateInvoice(input)).toBe(inv);
    expect(service.update).toHaveBeenCalledWith(3, input);
  });

  it('removeInvoice should call service.remove', () => {
    (service.remove as jest.Mock).mockReturnValue(true);
    expect(resolver.removeInvoice(4)).toBe(true);
    expect(service.remove).toHaveBeenCalledWith(4);
  });

  it('invoicesByUser should call service.findByUser', () => {
    const arr = [] as Invoice[];
    (service.findByUser as jest.Mock).mockReturnValue(arr);
    expect(resolver.invoicesByUser(5)).toBe(arr);
    expect(service.findByUser).toHaveBeenCalledWith(5);
  });
});
