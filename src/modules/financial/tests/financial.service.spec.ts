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

describe('FinancialService', () => {
  let service: FinancialService;
  let reportRepo: Partial<Record<keyof Repository<FinancialReport>, jest.Mock>>;
  let expenseRepo: Partial<Record<keyof Repository<Expense>, jest.Mock>>;
  let aircraftRepo: Partial<Record<keyof Repository<Aircraft>, jest.Mock>>;
  let reservationRepo: Partial<
    Record<keyof Repository<Reservation>, jest.Mock>
  >;
  let adminRepo: Partial<Record<keyof Repository<Administration>, jest.Mock>>;

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

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialService,
        { provide: getRepositoryToken(FinancialReport), useValue: reportRepo },
        { provide: getRepositoryToken(Expense), useValue: expenseRepo },
        { provide: getRepositoryToken(Aircraft), useValue: aircraftRepo },
        { provide: getRepositoryToken(Reservation), useValue: reservationRepo },
        { provide: getRepositoryToken(Administration), useValue: adminRepo },
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
    it('aggregateRevenuesForPeriod calculates revenue', async () => {
      const admin = { id: 1, flightHourRate: 50 } as any;
      const reservations = [
        { estimated_flight_hours: 2, status: ReservationStatus.CONFIRMED },
      ];
      adminRepo.findOne.mockResolvedValue(admin);
      reservationRepo.find.mockResolvedValue(reservations as any);
      expect(await service.aggregateRevenuesForPeriod(start, end)).toBe(100);
    });

    it('aggregateExpensesForPeriod sums recorded and fuel', async () => {
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
      const total = await service.aggregateExpensesForPeriod(start, end);
      expect(total).toBeCloseTo(20 + 1 * 50 * 10);
    });

    it('generateBudgetForecast returns correct forecast', async () => {
      const admin = { id: 1, flightHourRate: 2, fuelPrice: 5 } as any;
      adminRepo.findOne.mockResolvedValue(admin);
      reservationRepo.find.mockResolvedValue([
        { estimated_flight_hours: 3, status: ReservationStatus.CONFIRMED },
      ] as any);
      const qb: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ sum: '6' }),
      };
      expenseRepo.createQueryBuilder.mockReturnValue(qb);

      const { revenueForecast, expenseForecast, netForecast } =
        await service.generateBudgetForecast(start, end);
      expect(revenueForecast).toBe(6); // 3*2
      expect(expenseForecast).toBeCloseTo(6 + 3 * 50 * 5);
      expect(netForecast).toBe(revenueForecast - expenseForecast);
    });
  });
});
