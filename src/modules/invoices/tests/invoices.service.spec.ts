import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PDFDocument } from 'pdf-lib';
import { InvoicesService } from '../invoices.service';
import { Invoice } from '../entity/invoices.entity';
import {
  formatInvoiceNumber,
  invoiceYear,
  NEXT_INVOICE_NUMBER_SQL,
  nextInvoiceNumber,
  parseInvoiceLines,
} from '../invoice-number';
import { invoiceLineLabel, invoiceLines, invoiceMoney } from '../invoice-pdf';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let repo: Record<string, any>;
  let manager: {
    transaction: jest.Mock;
    query: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    getRepository: jest.Mock;
  };
  let counters: Map<number, number>;
  let inTransaction: boolean;

  beforeEach(async () => {
    counters = new Map();
    inTransaction = false;
    manager = {
      transaction: jest.fn(async (work) => {
        inTransaction = true;
        const snapshot = new Map(counters);
        try {
          return await work(manager);
        } catch (error) {
          // A rolled-back transaction gives its number back.
          counters = snapshot;
          throw error;
        } finally {
          inTransaction = false;
        }
      }),
      query: jest.fn(async (sql: string, [year]: number[]) => {
        if (sql !== NEXT_INVOICE_NUMBER_SQL || !inTransaction) {
          throw new Error('unexpected statement, or outside a transaction');
        }
        counters.set(year, (counters.get(year) ?? 0) + 1);
        return [{ last_number: counters.get(year) }];
      }),
      create: jest.fn((_entity, row) => ({ ...row })),
      save: jest.fn(async (_entity, row) => ({ id: 1, ...row })),
      getRepository: jest.fn(() => ({
        find: jest
          .fn()
          .mockResolvedValue([
            { clubName: 'Aéroclub de Test', address: '1 rue du Terrain' },
          ]),
      })),
    };
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      manager,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: getRepositoryToken(Invoice), useValue: repo },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  const input = (date = new Date('2026-03-10T10:00:00Z')) =>
    ({
      user_id: 1,
      amount: 100,
      invoice_date: date,
      balance_due: 50,
    }) as any;

  // This test used to check an invoice created with no number at all.
  it('creates an invoice attached to its member, with the next number of its year', async () => {
    const first = await service.create(input());
    const second = await service.create(input());

    // user_id is not a column: the invoice is attached through its relation.
    expect(first).toMatchObject({
      amount: 100,
      balance_due: 50,
      user: { id: 1 },
      payment_status: 'paid',
      invoice_number: '2026-00001',
    });
    expect(second.invoice_number).toBe('2026-00002');
    expect(manager.transaction).toHaveBeenCalledTimes(2);
  });

  it('numbers each year on its own', async () => {
    await service.create(input(new Date('2026-06-01T10:00:00Z')));
    const nextYear = await service.create(
      input(new Date('2027-01-05T10:00:00Z')),
    );
    const backIn2026 = await service.create(
      input(new Date('2026-12-01T10:00:00Z')),
    );

    expect(nextYear.invoice_number).toBe('2027-00001');
    expect(backIn2026.invoice_number).toBe('2026-00002');
  });

  it('leaves no gap when an invoice cannot be saved', async () => {
    manager.save.mockRejectedValueOnce(new Error('disk full'));

    await expect(service.create(input())).rejects.toThrow('disk full');
    const next = await service.create(input());

    // The number taken by the failed transaction was given back.
    expect(next.invoice_number).toBe('2026-00001');
  });

  it('takes the year of the club, not of the server clock', () => {
    // 31 December 23:30 UTC is already 1 January in Paris.
    expect(invoiceYear(new Date('2026-12-31T23:30:00Z'))).toBe(2027);
    expect(invoiceYear(new Date('2026-12-31T22:30:00Z'))).toBe(2026);
    expect(formatInvoiceNumber(2026, 42)).toBe('2026-00042');
  });

  it('refuses to hand out a number the database did not give', async () => {
    const broken = { query: jest.fn().mockResolvedValue([]) } as any;

    await expect(nextInvoiceNumber(broken, new Date())).rejects.toThrow(
      'Invoice number could not be assigned',
    );
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

  // Removing used to delete any invoice, numbered or not.
  describe('remove', () => {
    it('never deletes a numbered invoice: its number would be missing', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({
        id: 4,
        invoice_number: '2026-00004',
      });

      await expect(service.remove(4)).rejects.toThrow(
        'Une facture numérotée ne peut pas être supprimée',
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('still removes a draft without a number, and says when there is nothing', async () => {
      (repo.findOne as jest.Mock).mockResolvedValueOnce({ id: 4 });
      (repo.delete as jest.Mock).mockResolvedValue({ affected: 1 });
      expect(await service.remove(4)).toBe(true);

      (repo.findOne as jest.Mock).mockResolvedValueOnce(null);
      expect(await service.remove(5)).toBe(false);
    });
  });

  it('lists the invoices of a member, newest first', async () => {
    const userInvoices = [{ id: 6 }] as Invoice[];
    (repo.find as jest.Mock).mockResolvedValue(userInvoices);
    expect(await service.findByUser(7)).toBe(userInvoices);
    expect(repo.find).toHaveBeenCalledWith({
      where: { user: { id: 7 } },
      relations: ['payments'],
      order: { invoice_date: 'DESC', id: 'DESC' },
    });
  });

  describe('document', () => {
    const invoice = {
      id: 12,
      invoice_number: '2026-00012',
      invoice_date: new Date('2026-03-10T10:00:00Z'),
      amount: 199.99,
      amount_paid: 199.99,
      balance_due: 0,
      payment_method: 'account_balance',
      invoice_items: JSON.stringify([
        {
          kind: 'booking',
          amount: 199.99,
          reservationId: 77,
          registration: 'F-GABC',
          start: '2026-03-12T09:00:00.000Z',
          end: '2026-03-12T10:30:00.000Z',
        },
      ]),
      // A narrow no-break space and an emoji must not break the document.
      user: {
        first_name: 'Zoé ',
        last_name: 'Müller 🛩',
        email: 'zoe@club.fr',
      },
    } as unknown as Invoice;

    it.each([
      ['fr', 'facture-2026-00012.pdf'],
      ['en', 'invoice-2026-00012.pdf'],
    ] as const)(
      'gives a PDF named after the invoice number (%s)',
      async (language, fileName) => {
        const file = await service.document(invoice, language);

        expect(file.fileName).toBe(fileName);
        const bytes = Buffer.from(file.content, 'base64');
        expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
        expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
      },
    );

    it('says what the invoice is for, in the language asked', () => {
      const [line] = invoiceLines(invoice);

      // Club time (Paris), whatever the clock of the server.
      expect(invoiceLineLabel(line, 'fr')).toMatch(
        /^Réservation de l'avion F-GABC, du 12 mars 2026.{1,4}10:00 au 12 mars 2026.{1,4}11:30$/,
      );
      expect(invoiceLineLabel(line, 'en')).toContain(
        'Booking of aircraft F-GABC, from 12 March 2026',
      );
      expect(invoiceMoney('199.99', 'fr')).toBe('199,99 €');
      expect(invoiceMoney(199.99, 'en')).toBe('€199.99');
    });

    it('says an instruction flight was flown with its instructor, in both languages', () => {
      const [line] = invoiceLines(invoice);
      const withInstructor = { ...line, instructor: 'Claire Morel' } as any;

      expect(invoiceLineLabel(withInstructor, 'fr')).toMatch(
        /^Vol d'instruction sur l'avion F-GABC avec l'instructeur Claire Morel, du 12 mars 2026/,
      );
      expect(invoiceLineLabel(withInstructor, 'en')).toMatch(
        /^Instruction flight on aircraft F-GABC with instructor Claire Morel, from 12 March 2026/,
      );
      // Without an instructor the line is unchanged.
      expect(invoiceLineLabel(line, 'fr')).not.toContain('instructeur');
    });

    it('describes an invoice made before lines were stored by its payment method', () => {
      expect(
        invoiceLines({ amount: 50, payment_method: 'stripe' } as Invoice),
      ).toEqual([{ kind: 'top_up', amount: 50, method: 'stripe' }]);
      expect(
        invoiceLines({
          amount: 50,
          payment_method: 'account_balance',
        } as Invoice),
      ).toEqual([{ kind: 'booking', amount: 50 }]);
      // Free text typed by an administrator is kept as the line.
      expect(parseInvoiceLines('Cotisation annuelle')).toEqual([
        { kind: 'other', amount: 0, label: 'Cotisation annuelle' },
      ]);
    });
  });
});
