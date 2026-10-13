import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinancialService } from '../financial.service';
import { FinancialReport } from '../entity/financial-report.entity';
import { Expense } from '../entity/expense.entity';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import {
  Reservation,
  ReservationStatus,
} from '../../reservations/entity/reservations.entity';
import { Administration } from '../../administration/entity/admin.entity';
import { NotFoundException } from '@nestjs/common';
import { Payment } from '../../payments/entity/payments.entity';
import { cashFlowOf } from '../financial.service';

describe('FinancialService', () => {
  let service: FinancialService;
  let reportRepo: Partial<Record<keyof Repository<FinancialReport>, jest.Mock>>;
  let expenseRepo: Partial<Record<keyof Repository<Expense>, jest.Mock>>;
  let aircraftRepo: Partial<Record<keyof Repository<Aircraft>, jest.Mock>>;
  let reservationRepo: Partial<
    Record<keyof Repository<Reservation>, jest.Mock>
  >;
  let adminRepo: Partial<Record<keyof Repository<Administration>, jest.Mock>>;
  let paymentRepo: { find: jest.Mock };

  beforeEach(async () => {
    reportRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      preload: jest.fn(),
      delete: jest.fn(),
    };
    expenseRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      preload: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    aircraftRepo = { findOne: jest.fn() };
    reservationRepo = { find: jest.fn() };
    adminRepo = { findOne: jest.fn() };
    paymentRepo = { find: jest.fn().mockResolvedValue([]) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialService,
        { provide: getRepositoryToken(FinancialReport), useValue: reportRepo },
        { provide: getRepositoryToken(Expense), useValue: expenseRepo },
        { provide: getRepositoryToken(Aircraft), useValue: aircraftRepo },
        { provide: getRepositoryToken(Reservation), useValue: reservationRepo },
        { provide: getRepositoryToken(Administration), useValue: adminRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
      ],
    }).compile();

    service = moduleRef.get<FinancialService>(FinancialService);
  });

  describe('FinancialReport CRUD', () => {
    it('createFinancialReport calculates net_profit and saves', async () => {
      const now = new Date();
      const input: any = {
        report_date: now,
        total_revenue: 200,
        total_expense: 50,
      };
      const created = { id: 1, ...input, net_profit: 150 };
      reportRepo.create.mockReturnValue(created);
      reportRepo.save.mockResolvedValue(created);

      const result = await service.createFinancialReport(input);
      expect(reportRepo.create).toHaveBeenCalledWith({
        ...input,
        net_profit: 150,
      });
      expect(result).toBe(created);
    });

    it('findAllFinancialReports returns array', async () => {
      const list = [{ id: 2 }];
      reportRepo.find.mockResolvedValue(list as any);
      expect(await service.findAllFinancialReports()).toBe(list);
    });

    it('findFinancialReport throws NotFoundException if missing', async () => {
      reportRepo.findOne.mockResolvedValue(undefined);
      await expect(service.findFinancialReport(3)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updateFinancialReport updates and returns report', async () => {
      const updated: any = {
        id: 4,
        total_revenue: 300,
        total_expense: 100,
        net_profit: 200,
      };
      reportRepo.preload.mockResolvedValue(updated);
      reportRepo.save.mockResolvedValue(updated);

      const result = await service.updateFinancialReport({
        id: 4,
        total_revenue: 300,
        total_expense: 100,
      } as any);
      expect(reportRepo.preload).toHaveBeenCalledWith({
        id: 4,
        total_revenue: 300,
        total_expense: 100,
      });
      expect(result).toBe(updated);
    });

    it('removeFinancialReport returns true when deleted', async () => {
      reportRepo.delete.mockResolvedValue({ affected: 1 } as any);
      expect(await service.removeFinancialReport(5)).toBe(true);
    });
  });

  describe('Expense CRUD', () => {
    it('createExpense with valid aircraft', async () => {
      const input: any = {
        expense_date: new Date(0),
        amount: 100,
        category: 'Fuel',
        aircraft_id: 5,
      };
      const aircraft = { id: 5 } as any;
      const created = { id: 6 } as any;
      aircraftRepo.findOne.mockResolvedValue(aircraft);
      expenseRepo.create.mockReturnValue(created);
      expenseRepo.save.mockResolvedValue(created);

      const result = await service.createExpense(input);
      expect(expenseRepo.create).toHaveBeenCalledWith({ ...input, aircraft });
      expect(result).toBe(created);
    });

    it('createExpense throws NotFoundException if aircraft missing', async () => {
      aircraftRepo.findOne.mockResolvedValue(undefined);
      await expect(
        service.createExpense({ aircraft_id: 9 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('findAllExpenses returns expenses array', async () => {
      const list = [{ id: 7 }];
      expenseRepo.find.mockResolvedValue(list as any);
      expect(await service.findAllExpenses()).toBe(list);
    });

    it('findExpense throws NotFoundException if missing', async () => {
      expenseRepo.findOne.mockResolvedValue(undefined);
      await expect(service.findExpense(8)).rejects.toThrow(NotFoundException);
    });

    it('updateExpense updates when valid', async () => {
      const existing: any = { id: 9 };
      expenseRepo.preload.mockResolvedValue(existing);
      expenseRepo.save.mockResolvedValue(existing);

      const result = await service.updateExpense({ id: 9, amount: 150 } as any);
      expect(expenseRepo.preload).toHaveBeenCalledWith({ id: 9, amount: 150 });
      expect(result).toBe(existing);
    });

    it('removeExpense returns true when deleted', async () => {
      expenseRepo.delete.mockResolvedValue({ affected: 1 } as any);
      expect(await service.removeExpense(10)).toBe(true);
    });
  });

  describe('Aggregations & Forecast', () => {
    const start = new Date(0),
      end = new Date();
    it('aggregateRevenuesForPeriod sums what the members were charged', async () => {
      const admin = { id: 1, flightHourRate: 50 } as any;
      // Postgres returns the stored amounts as text.
      const reservations = [
        { estimated_flight_hours: 2, charged_amount: '560.00' },
        { charged_amount: '199.99' },
        // An old booking whose charge is unknown counts for nothing.
        { estimated_flight_hours: 3, charged_amount: null },
      ];
      adminRepo.findOne.mockResolvedValue(admin);
      reservationRepo.find.mockResolvedValue(reservations as any);
      // Not estimated hours x the club rate (2 x 50 + 3 x 50).
      expect(await service.aggregateRevenuesForPeriod(start, end)).toBe(759.99);
    });

    // This test used to expect an invented fuel cost on top of the
    // recorded expenses: 50 L per estimated flight hour at the club's fuel
    // price (20 + 1 x 50 x 10 = 520).
    it('aggregateExpensesForPeriod is what was recorded, with no estimated fuel', async () => {
      const admin = { id: 1, fuelPrice: 10 } as any;
      const qb: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ sum: '20' }),
      };
      adminRepo.findOne.mockResolvedValue(admin);
      expenseRepo.createQueryBuilder.mockReturnValue(qb);
      reservationRepo.find.mockResolvedValue([
        { estimated_flight_hours: 1, status: ReservationStatus.CONFIRMED },
      ] as any);

      expect(await service.aggregateExpensesForPeriod(start, end)).toBe(20);
    });

    it('generateBudgetForecast returns correct forecast', async () => {
      const admin = { id: 1, flightHourRate: 2, fuelPrice: 5 } as any;
      adminRepo.findOne.mockResolvedValue(admin);
      reservationRepo.find.mockResolvedValue([
        {
          estimated_flight_hours: 3,
          charged_amount: 420,
          status: ReservationStatus.CONFIRMED,
        },
      ] as any);
      const qb: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ sum: '6' }),
      };
      expenseRepo.createQueryBuilder.mockReturnValue(qb);
      paymentRepo.find.mockResolvedValue([
        {
          kind: 'top_up',
          amount: '500.00',
          payment_status: 'completed',
          payment_method: 'stripe',
        },
        {
          kind: 'provider_refund',
          amount: '20.00',
          payment_status: 'completed',
          payment_method: 'stripe',
        },
      ]);

      const forecast = await service.generateBudgetForecast(start, end);
      // What was charged, not 3 h x the club rate.
      expect(forecast.revenueForecast).toBe(420);
      // Recorded expenses only (it used to add 3 x 50 x 5 of fuel).
      expect(forecast.expenseForecast).toBe(6);
      expect(forecast.netForecast).toBe(414);
      // Cash received is shown next to revenue, not mixed with it.
      expect(forecast.cashReceived).toBe(500);
      expect(forecast.cashRefunded).toBe(20);
    });
  });

  describe('cash received', () => {
    const line = (
      kind: string,
      amount: string,
      status = 'completed',
      method = 'stripe',
    ) => ({
      kind,
      amount: amount as unknown as number,
      payment_status: status,
      payment_method: method,
    });

    it('counts the money members paid in, not what moved inside their accounts', () => {
      expect(
        cashFlowOf([
          line('top_up', '100.00'),
          // Still counted once refunded: the refund is its own line.
          line('top_up', '50.10', 'refunded'),
          // Never paid.
          line('top_up', '999.00', 'pending'),
          line('top_up', '999.00', 'failed'),
          line('manual_credit', '30.00', 'completed', 'cash'),
          line('manual_credit', '40.00', 'completed', 'cheque'),
          line('manual_credit', '10.20', 'completed', 'transfer'),
          // A correction brings no money in.
          line('manual_credit', '500.00', 'completed', 'correction'),
          // Flights and their refunds move the balance, not the bank account.
          line('booking', '150.00', 'completed', 'account_balance'),
          line('booking_refund', '150.00', 'completed', 'account_balance'),
          line('manual_debit', '20.00', 'completed', 'correction'),
        ]),
      ).toEqual({ cashReceived: 230.3, cashRefunded: 0 });
    });

    it('counts what the provider gave back, less the chargebacks the club won', () => {
      expect(
        cashFlowOf([
          line('provider_refund', '20.00'),
          line('provider_refund', '100.00'),
          line('dispute_won', '100.00'),
        ]),
      ).toEqual({ cashReceived: 0, cashRefunded: 20 });
    });

    it('reads the lines of the period from the payments table', async () => {
      paymentRepo.find.mockResolvedValue([line('top_up', '75.00')]);
      const from = new Date('2026-09-01');
      const to = new Date('2026-09-30');

      await expect(service.cashFlowForPeriod(from, to)).resolves.toEqual({
        cashReceived: 75,
        cashRefunded: 0,
      });
      const { where } = paymentRepo.find.mock.calls[0][0];
      expect(where.payment_date.value).toEqual([from, to]);
      expect(where.kind.value).toEqual([
        'top_up',
        'manual_credit',
        'provider_refund',
        'dispute_won',
      ]);
    });
  });

  describe('PDF export', () => {
    it('prints expenses whose amount comes back from the database as text', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 1, fuelPrice: 2 } as any);
      reservationRepo.find.mockResolvedValue([
        { id: 4, estimated_flight_hours: 1, charged_amount: '150.00' },
      ] as any);
      expenseRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ sum: '80.50' }),
      } as any);
      expenseRepo.find.mockResolvedValue([
        {
          id: 1,
          category: 'Carburant',
          amount: '80.50',
          expense_date: new Date('2026-01-10'),
        },
      ] as any);
      const written = jest
        .spyOn(service as any, 'writeExport')
        .mockImplementation(() => undefined);

      const url = await service.generateFinancialReportByPeriodPDF(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(url).toMatch(/^\/uploads\/exports\/financial-report-.*\.pdf$/);
      expect(written).toHaveBeenCalledTimes(1);
    });
  });
});
