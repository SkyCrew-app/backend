import { Test, TestingModule } from '@nestjs/testing';
import { FinancialResolver, BudgetForecast } from '../financial.resolver';
import { FinancialService } from '../financial.service';

describe('FinancialResolver', () => {
  let resolver: FinancialResolver;
  let service: any;

  beforeEach(async () => {
    service = {
      findAllFinancialReports: jest.fn(),
      findFinancialReport: jest.fn(),
      createFinancialReport: jest.fn(),
      updateFinancialReport: jest.fn(),
      removeFinancialReport: jest.fn(),
      findAllExpenses: jest.fn(),
      findExpense: jest.fn(),
      findExpenseByPeriod: jest.fn(),
      createExpense: jest.fn(),
      updateExpense: jest.fn(),
      removeExpense: jest.fn(),
      generateBudgetForecast: jest.fn(),
      generateFinancialReportByPeriodPDF: jest.fn(),
      generateFinancialReportByPeriodCSV: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialResolver,
        { provide: FinancialService, useValue: service },
      ],
    }).compile();

    resolver = moduleRef.get<FinancialResolver>(FinancialResolver);
  });

  it('getFinancialReports calls service', async () => {
    service.findAllFinancialReports.mockResolvedValue([]);
    expect(await resolver.getFinancialReports()).toEqual([]);
    expect(service.findAllFinancialReports).toHaveBeenCalled();
  });

  it('getFinancialReport calls service', async () => {
    service.findFinancialReport.mockResolvedValue({ id: 1 });
    expect(await resolver.getFinancialReport(1)).toEqual({ id: 1 });
  });

  it('createFinancialReport calls service', async () => {
    const dto: any = {
      report_date: new Date(0),
      total_revenue: 100,
      total_expense: 20,
      net_profit: 80,
    };
    service.createFinancialReport.mockResolvedValue({ id: 2 });
    expect(await resolver.createFinancialReport(dto)).toEqual({ id: 2 });
  });

  it('updateFinancialReport calls service', async () => {
    const dto: any = { id: 3, total_revenue: 150 };
    service.updateFinancialReport.mockResolvedValue({ id: 3 });
    expect(await resolver.updateFinancialReport(dto)).toEqual({ id: 3 });
  });

  it('removeFinancialReport calls service', async () => {
    service.removeFinancialReport.mockResolvedValue(true);
    expect(await resolver.removeFinancialReport(4)).toBe(true);
  });

  it('getExpenses calls service', async () => {
    service.findAllExpenses.mockResolvedValue([]);
    expect(await resolver.getExpenses()).toEqual([]);
  });

  it('getExpense calls service', async () => {
    service.findExpense.mockResolvedValue({ id: 5 });
    expect(await resolver.getExpense(5)).toEqual({ id: 5 });
  });

  it('getExpenseByPeriod calls service', async () => {
    const start = new Date(0),
      end = new Date();
    service.findExpenseByPeriod.mockResolvedValue([]);
    expect(await resolver.getExpenseByPeriod(start, end)).toEqual([]);
  });

  it('createExpense calls service', async () => {
    const dto: any = {
      expense_date: new Date(0),
      amount: 100,
      category: 'Test',
    };
    service.createExpense.mockResolvedValue({ id: 6 });
    expect(await resolver.createExpense(dto)).toEqual({ id: 6 });
  });

  it('updateExpense calls service', async () => {
    const dto: any = { id: 7, amount: 200 };
    service.updateExpense.mockResolvedValue({ id: 7 });
    expect(await resolver.updateExpense(dto)).toEqual({ id: 7 });
  });

  it('removeExpense calls service', async () => {
    service.removeExpense.mockResolvedValue(true);
    expect(await resolver.removeExpense(8)).toBe(true);
  });

  it('generateBudgetForecast returns BudgetForecast', async () => {
    const forecast = {
      revenueForecast: 10,
      expenseForecast: 5,
      netForecast: 5,
    };
    service.generateBudgetForecast.mockResolvedValue(forecast);
    const result = await resolver.generateBudgetForecast(
      new Date(),
      new Date(),
    );
    expect(result).toBeInstanceOf(BudgetForecast);
  });

  it('generate PDF and CSV URLs', async () => {
    const start = new Date(0),
      end = new Date(1000);
    service.generateFinancialReportByPeriodPDF.mockResolvedValue('path.pdf');
    service.generateFinancialReportByPeriodCSV.mockResolvedValue('path.csv');
    const pdf = await resolver.generateFinancialReportPDFByPeriod(start, end);
    const csv = await resolver.generateFinancialReportCSVByPeriod(start, end);
    expect(pdf).toContain('financial-report-0-1000.pdf');
    expect(csv).toContain('financial-report-0-1000.csv');
  });
});
