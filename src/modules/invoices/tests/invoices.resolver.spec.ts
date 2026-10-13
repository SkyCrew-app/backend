import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesResolver } from '../invoices.resolver';
import { InvoicesService } from '../invoices.service';
import { Invoice } from '../entity/invoices.entity';

const admin = {
  id: 1,
  email: 'admin@example.com',
  role: { role_name: 'Administrateur' },
} as any;
const holder = {
  id: 3,
  email: 'holder@example.com',
  role: { role_name: 'Pilote' },
} as any;
const stranger = {
  id: 7,
  email: 'stranger@example.com',
  role: { role_name: 'Pilote' },
} as any;

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
      document: jest.fn(),
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
    (service.findOne as jest.Mock).mockResolvedValue(inv);
    return expect(resolver.findOne(2, admin)).resolves.toBe(inv);
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
    expect(resolver.invoicesByUser(5, admin)).toBe(arr);
    expect(service.findByUser).toHaveBeenCalledWith(5);
  });
  describe('authorization', () => {
    it("refuses a member listing another user's invoices", () => {
      expect(() => resolver.invoicesByUser(3, stranger)).toThrow(
        ForbiddenException,
      );
      expect(service.findByUser).not.toHaveBeenCalled();
    });

    it('lets a member list their own invoices', () => {
      const invoices = [] as Invoice[];
      (service.findByUser as jest.Mock).mockReturnValue(invoices);

      expect(resolver.invoicesByUser(3, holder)).toBe(invoices);
    });

    it("refuses a member reading another user's invoice", async () => {
      (service.findOne as jest.Mock).mockResolvedValue({ user: { id: 3 } });

      await expect(resolver.findOne(2, stranger)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lets a member read their own invoice', async () => {
      const invoice = { user: { id: 3 } };
      (service.findOne as jest.Mock).mockResolvedValue(invoice);

      await expect(resolver.findOne(2, holder)).resolves.toBe(invoice);
    });
  });

  describe('invoiceDocument', () => {
    const invoice = { id: 5, user: { id: holder.id } } as Invoice;
    const file = { fileName: 'facture-2026-00005.pdf', content: 'JVBERi0=' };

    beforeEach(() => {
      (service.findOne as jest.Mock).mockResolvedValue(invoice);
      (service.document as jest.Mock).mockResolvedValue(file);
    });

    it.each([
      ['the member it was issued to', holder],
      ['an administrator', admin],
    ])(
      'gives the PDF to %s, in the language of the interface',
      async (_label, caller) => {
        await expect(resolver.invoiceDocument(5, caller, 'en')).resolves.toBe(
          file,
        );
        expect(service.document).toHaveBeenCalledWith(invoice, 'en');
      },
    );

    it('refuses another member', async () => {
      await expect(resolver.invoiceDocument(5, stranger, 'fr')).rejects.toThrow(
        ForbiddenException,
      );
      expect(service.document).not.toHaveBeenCalled();
    });

    it('answers not found for an unknown invoice', async () => {
      (service.findOne as jest.Mock).mockResolvedValue(null);

      await expect(resolver.invoiceDocument(404, admin, 'fr')).rejects.toThrow(
        'Invoice not found',
      );
    });
  });
});
