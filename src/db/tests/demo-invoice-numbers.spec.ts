import { numberDemoInvoices } from '../demo/demo-invoices.seeder';
import { NEXT_INVOICE_NUMBER_SQL } from '../../modules/invoices/invoice-number';

// The demo invoices get their numbers from the yearly sequence the API
// uses, in the order of their dates.
describe('numberDemoInvoices', () => {
  it('numbers the unnumbered invoices in date order, per year, through the sequence', async () => {
    const invoices = [
      { id: 1, invoice_date: new Date('2026-03-01T10:00:00Z') },
      { id: 2, invoice_date: new Date('2026-01-02T10:00:00Z') },
      { id: 3, invoice_date: new Date('2025-12-30T10:00:00Z') },
    ];
    const counters = new Map<number, number>([[2026, 2]]);
    const updates: Record<number, string> = {};
    const manager = {
      find: jest.fn(async (_entity, options) => {
        expect(options.where.invoice_number.type).toBe('isNull');
        expect(options.order).toEqual({ invoice_date: 'ASC', id: 'ASC' });
        return [...invoices].sort(
          (a, b) => a.invoice_date.getTime() - b.invoice_date.getTime(),
        );
      }),
      query: jest.fn(async (sql: string, [year]: number[]) => {
        expect(sql).toBe(NEXT_INVOICE_NUMBER_SQL);
        const next = (counters.get(year) ?? 0) + 1;
        counters.set(year, next);
        return [{ last_number: next }];
      }),
      update: jest.fn(async (_entity, { id }, { invoice_number }) => {
        updates[id] = invoice_number;
      }),
    };
    const dataSource = {
      transaction: (work: (m: typeof manager) => Promise<unknown>) =>
        work(manager),
    };
    jest.spyOn(console, 'log').mockImplementation();

    const count = await numberDemoInvoices(dataSource as any);

    expect(count).toBe(3);
    expect(updates).toEqual({
      3: '2025-00001',
      2: '2026-00003',
      1: '2026-00004',
    });
  });
});
