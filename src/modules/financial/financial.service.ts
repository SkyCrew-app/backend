import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { FinancialReport } from './entity/financial-report.entity';
import { Expense } from './entity/expense.entity';
import { CreateFinancialReportInput } from './dto/create-financial-report.dto';
import { UpdateFinancialReportInput } from './dto/update-financial-report.dto';
import { CreateExpenseInput } from './dto/create-expense.dto';
import { UpdateExpenseInput } from './dto/update-expense.dto';
import { Aircraft } from '../aircraft/entity/aircraft.entity';
import {
  Reservation,
  ReservationStatus,
} from '../reservations/entity/reservations.entity';
import { Administration } from '../administration/entity/admin.entity';
import { join } from 'path';
import { Parser } from 'json2csv';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';

@Injectable()
export class FinancialService {
  constructor(
    @InjectRepository(FinancialReport)
    private readonly financialReportRepository: Repository<FinancialReport>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Aircraft)
    private readonly aircraftRepository: Repository<Aircraft>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @InjectRepository(Administration)
    private readonly adminRepository: Repository<Administration>,
  ) {}

  async createFinancialReport(
    input: CreateFinancialReportInput,
  ): Promise<FinancialReport> {
    if (input.net_profit === undefined || input.net_profit === null) {
      input.net_profit = input.total_revenue - input.total_expense;
    }
    const report = this.financialReportRepository.create(input);
    return await this.financialReportRepository.save(report);
  }

  async findAllFinancialReports(): Promise<FinancialReport[]> {
    return await this.financialReportRepository.find();
  }

  async findFinancialReport(id: number): Promise<FinancialReport> {
    const report = await this.financialReportRepository.findOne({
      where: { id },
    });
    if (!report) {
      throw new NotFoundException(`FinancialReport with id ${id} not found`);
    }
    return report;
  }

  async updateFinancialReport(
    input: UpdateFinancialReportInput,
  ): Promise<FinancialReport> {
    const report = await this.financialReportRepository.preload(input);
    if (!report) {
      throw new NotFoundException(
        `FinancialReport with id ${input.id} not found`,
      );
    }
    if (
      input.total_revenue !== undefined ||
      input.total_expense !== undefined
    ) {
      report.net_profit = report.total_revenue - report.total_expense;
    }
    return await this.financialReportRepository.save(report);
  }

  async removeFinancialReport(id: number): Promise<boolean> {
    const result = await this.financialReportRepository.delete(id);
    return result.affected > 0;
  }

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    const expenseData: any = { ...input };

    if (input.aircraft_id) {
      const aircraft = await this.aircraftRepository.findOne({
        where: { id: input.aircraft_id },
      });
      if (!aircraft) {
        throw new NotFoundException(
          `Aircraft with id ${input.aircraft_id} not found`,
        );
      }
      expenseData.aircraft = aircraft;
    }
    const expense = this.expenseRepository.create(expenseData);
    const savedExpense = await this.expenseRepository.save(expense);
    return Array.isArray(savedExpense) ? savedExpense[0] : savedExpense;
  }

  async findAllExpenses(): Promise<Expense[]> {
    return await this.expenseRepository.find({ relations: ['aircraft'] });
  }

  async findExpense(id: number): Promise<Expense> {
    const expense = await this.expenseRepository.findOne({
      where: { id },
      relations: ['aircraft'],
    });
    if (!expense) {
      throw new NotFoundException(`Expense with id ${id} not found`);
    }
    return expense;
  }

  async updateExpense(input: UpdateExpenseInput): Promise<Expense> {
    const expense = await this.expenseRepository.preload(input);
    if (!expense) {
      throw new NotFoundException(`Expense with id ${input.id} not found`);
    }
    if (input.aircraft_id) {
      const aircraft = await this.aircraftRepository.findOne({
        where: { id: input.aircraft_id },
      });
      if (!aircraft) {
        throw new NotFoundException(
          `Aircraft with id ${input.aircraft_id} not found`,
        );
      }
      expense.aircraft = aircraft;
    }
    return await this.expenseRepository.save(expense);
  }

  async removeExpense(id: number): Promise<boolean> {
    const result = await this.expenseRepository.delete(id);
    return result.affected > 0;
  }

  async aggregateRevenuesForPeriod(start: Date, end: Date): Promise<number> {
    const admin = await this.adminRepository.findOne({ where: { id: 1 } });
    if (!admin) {
      throw new NotFoundException('Administration record not found');
    }

    const reservations = await this.reservationRepository.find({
      where: {
        status: ReservationStatus.CONFIRMED,
        start_time: Between(start, end),
      },
    });

    let totalRevenue = 0;
    for (const reservation of reservations) {
      if (reservation.estimated_flight_hours) {
        totalRevenue +=
          reservation.estimated_flight_hours * admin.flightHourRate;
      }
    }
    return totalRevenue;
  }

  async aggregateExpensesForPeriod(start: Date, end: Date): Promise<number> {
    const admin = await this.adminRepository.findOne({ where: { id: 1 } });
    if (!admin) {
      throw new NotFoundException('Administration record not found');
    }

    const expenseRaw = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'sum')
      .where('expense.expense_date BETWEEN :start AND :end', {
        start: start.toISOString(),
        end: end.toISOString(),
      })
      .getRawOne();
    const recordedExpenses = parseFloat(expenseRaw.sum) || 0;

    const reservations = await this.reservationRepository.find({
      where: {
        status: ReservationStatus.CONFIRMED,
        start_time: Between(start, end),
      },
    });

    const FUEL_CONSUMPTION_FACTOR = 50;
    let fuelExpenses = 0;
    for (const reservation of reservations) {
      if (reservation.estimated_flight_hours) {
        fuelExpenses +=
          reservation.estimated_flight_hours *
          FUEL_CONSUMPTION_FACTOR *
          admin.fuelPrice;
      }
    }

    return recordedExpenses + fuelExpenses;
  }

  async findExpenseByPeriod(
    startDate: Date,
    endDate: Date,
  ): Promise<Expense[]> {
    return await this.expenseRepository.find({
      where: {
        expense_date: Between(startDate, endDate),
      },
    });
  }

  async generateBudgetForecast(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    revenueForecast: number;
    expenseForecast: number;
    netForecast: number;
  }> {
    const admin = await this.adminRepository.findOne({
      where: { id: 1 },
    });
    if (!admin) {
      throw new NotFoundException('Administration record not found');
    }

    const reservations = await this.reservationRepository.find({
      where: {
        status: ReservationStatus.CONFIRMED,
        start_time: Between(startDate, endDate),
      },
    });

    let revenueForecast = 0;
    for (const reservation of reservations) {
      if (reservation.estimated_flight_hours) {
        revenueForecast +=
          reservation.estimated_flight_hours * admin.flightHourRate;
      }
    }

    const expenseRaw = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'sum')
      .where('expense.expense_date BETWEEN :start AND :end', {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      })
      .getRawOne();
    const recordedExpenses = parseFloat(expenseRaw.sum) || 0;

    const FUEL_CONSUMPTION_FACTOR = 50;
    let fuelExpenses = 0;
    for (const reservation of reservations) {
      if (reservation.estimated_flight_hours) {
        fuelExpenses +=
          reservation.estimated_flight_hours *
          FUEL_CONSUMPTION_FACTOR *
          admin.fuelPrice;
      }
    }

    const expenseForecast = recordedExpenses + fuelExpenses;

    const netForecast = revenueForecast - expenseForecast;

    return { revenueForecast, expenseForecast, netForecast };
  }

  async generateFinancialReportByPeriodPDF(
    startDate: Date,
    endDate: Date,
  ): Promise<string> {
    const forecast = await this.generateBudgetForecast(startDate, endDate);
    const reservations = await this.reservationRepository.find({
      where: {
        status: ReservationStatus.CONFIRMED,
        start_time: Between(startDate, endDate),
      },
    });
    const expenses = await this.expenseRepository.find({
      where: {
        expense_date: Between(startDate, endDate),
      },
    });
    const admin = await this.adminRepository.findOne({ where: { id: 1 } });
    if (!admin) throw new NotFoundException('Administration record not found');

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const page = pdfDoc.addPage([600, 800]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { width, height } = page.getSize();

    const logoPath = join(process.cwd(), 'assets', 'logo.png');
    let logoImage;
    try {
      const logoBytes = readFileSync(logoPath);
      logoImage = await pdfDoc.embedPng(logoBytes);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      console.warn('Logo non trouvé, il sera ignoré.');
    }
    if (logoImage) {
      const logoDims = logoImage.scale(0.5);
      page.drawImage(logoImage, {
        x: 50,
        y: height - 50 - logoDims.height,
        width: logoDims.width,
        height: logoDims.height,
      });
    }

    page.drawText('Rapport Financier', {
      x: 50,
      y: height - 100,
      size: 24,
      font,
      color: rgb(0, 0, 0.8),
    });
    page.drawText(
      `Période: ${startDate.toISOString().substring(0, 10)} - ${endDate.toISOString().substring(0, 10)}`,
      {
        x: 50,
        y: height - 130,
        size: 12,
        font,
      },
    );

    page.drawText(`Revenus totaux: ${forecast.revenueForecast.toFixed(2)} €`, {
      x: 50,
      y: height - 170,
      size: 14,
      font,
    });
    page.drawText(
      `Dépenses totales: ${forecast.expenseForecast.toFixed(2)} €`,
      {
        x: 50,
        y: height - 190,
        size: 14,
        font,
      },
    );
    page.drawText(`Profit net: ${forecast.netForecast.toFixed(2)} €`, {
      x: 50,
      y: height - 210,
      size: 14,
      font,
    });

    let currentY = height - 250;

    page.drawText('Recettes (Réservations Confirmées)', {
      x: 50,
      y: currentY,
      size: 16,
      font,
      color: rgb(0, 0, 0.6),
    });
    currentY -= 20;

    page.drawText('ID Réservation  |  Heures  |  Revenu (€)', {
      x: 50,
      y: currentY,
      size: 10,
      font,
    });
    currentY -= 15;

    reservations.forEach((res) => {
      const hours = res.estimated_flight_hours || 0;
      const revenue = hours * admin.flightHourRate;
      const line = `${res.id}  |  ${hours.toFixed(2)}  |  ${revenue.toFixed(2)}`;
      page.drawText(line, { x: 50, y: currentY, size: 10, font });
      currentY -= 12;
    });

    currentY -= 20;
    page.drawText('Dépenses', {
      x: 50,
      y: currentY,
      size: 16,
      font,
      color: rgb(0, 0, 0.6),
    });
    currentY -= 20;
    page.drawText(
      'ID  |  Catégorie  |  Sous-catégorie  |  Montant (€)  |  Date',
      { x: 50, y: currentY, size: 10, font },
    );
    currentY -= 15;
    expenses.forEach((exp) => {
      const line = `${exp.id}  |  ${exp.category}  |  ${exp.sub_category || '-'}  |  ${exp.amount.toFixed(2)}  |  ${new Date(exp.expense_date).toISOString().substring(0, 10)}`;
      page.drawText(line, { x: 50, y: currentY, size: 10, font });
      currentY -= 12;
    });

    page.drawText(
      'Document généré automatiquement. Aéroclub XYZ - Tous droits réservés.',
      {
        x: 50,
        y: 30,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      },
    );

    const pdfBytes = await pdfDoc.save();
    const fileName = `financial-report-${startDate.getTime()}-${endDate.getTime()}.pdf`;
    const filePath = join(process.cwd(), fileName);
    writeFileSync(filePath, pdfBytes);
    return filePath;
  }

  async generateFinancialReportByPeriodCSV(
    startDate: Date,
    endDate: Date,
  ): Promise<string> {
    const forecast = await this.generateBudgetForecast(startDate, endDate);

    // Créer l'objet JSON pour le rapport
    const data = [
      {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        revenueForecast: forecast.revenueForecast,
        expenseForecast: forecast.expenseForecast,
        netForecast: forecast.netForecast,
      },
    ];

    const fields = [
      'startDate',
      'endDate',
      'revenueForecast',
      'expenseForecast',
      'netForecast',
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    const fileName = `financial-report-${startDate.getTime()}-${endDate.getTime()}.csv`;
    const filePath = join(process.cwd(), fileName);
    writeFileSync(filePath, csv);
    return filePath;
  }
}
