import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoicesService } from '../invoices.service';
import { Invoice } from '../entity/invoices.entity';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let repo: Partial<Record<keyof Repository<Invoice>, jest.Mock>>;

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: getRepositoryToken(Invoice), useValue: repo },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  it('should create a new invoice', async () => {
    const input = {
      user_id: 1,
      amount: 100,
      invoice_date: new Date(),
      balance_due: 50,
    } as any;
    const created = { id: 1, ...input, payment_status: 'paid' } as Invoice;
    (repo.create as jest.Mock).mockReturnValue(created);
    (repo.save as jest.Mock).mockResolvedValue(created);

    const result = await service.create(input);
    expect(repo.create).toHaveBeenCalledWith({
      ...input,
      payment_status: 'paid',
    });
    expect(repo.save).toHaveBeenCalledWith(created);
    expect(result).toBe(created);
  });

  it('should return all invoices', async () => {
    const invoices = [{ id: 1 }] as Invoice[];
    (repo.find as jest.Mock).mockResolvedValue(invoices);
    expect(await service.findAll()).toBe(invoices);
  });

  it('should return one invoice by id', async () => {
    const invoice = { id: 2 } as Invoice;
    (repo.findOne as jest.Mock).mockResolvedValue(invoice);
    expect(await service.findOne(2)).toBe(invoice);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 2 },
      relations: ['user', 'payments'],
    });
  });

  it('should update an invoice', async () => {
    const updated = { id: 3, balance_due: 0 } as Invoice;
    (repo.update as jest.Mock).mockResolvedValue({});
    (repo.findOne as jest.Mock).mockResolvedValue(updated);
    expect(await service.update(3, { id: 3 } as any)).toBe(updated);
    expect(repo.update).toHaveBeenCalledWith(3, { id: 3 });
  });

  it('should remove an invoice', async () => {
    (repo.delete as jest.Mock).mockResolvedValue({ affected: 1 });
    expect(await service.remove(4)).toBe(true);
    (repo.delete as jest.Mock).mockResolvedValue({ affected: 0 });
    expect(await service.remove(5)).toBe(false);
  });

  it('should find invoices by user', async () => {
    const userInvoices = [{ id: 6 }] as Invoice[];
    (repo.find as jest.Mock).mockResolvedValue(userInvoices);
    expect(await service.findByUser(7)).toBe(userInvoices);
    expect(repo.find).toHaveBeenCalledWith({
      where: { user: { id: 7 } },
      relations: ['payments'],
    });
  });
});
