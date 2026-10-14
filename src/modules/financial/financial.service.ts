import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Payment, PAYMENT_KIND } from '../payments/entity/payments.entity';
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
import { mkdirSync, readFileSync, writeFileSync } from 'fs';

// What the members were actually charged for these bookings: the amount
// stored on each booking when it was paid, summed in cents.
export const chargedRevenue = (
  reservations: { charged_amount?: number | string | null }[],
): number =>
  reservations.reduce(
    (cents, reservation) =>
      cents + Math.round(Number(reservation.charged_amount ?? 0) * 100),
    0,
  ) / 100;

// Revenue only needs what each booking was charged: neither its member nor
// its aircraft (both eager) are loaded for a year of bookings.
const ONLY_CHARGED_AMOUNT = {
  select: { id: true, charged_amount: true },
  loadEagerRelations: false,
} as const;

// Manual entries that are money handed to the club. A "correction" moves a
// balance without any money coming in.
export const CASH_METHODS = ['cash', 'cheque', 'transfer'];

export interface CashFlow {
  // Money members paid in: card and PayPal top-ups, and the cash, cheques
  // and transfers an administrator recorded.
  cashReceived: number;
  // What went back to members through the payment provider (refunds and
  // chargebacks, less the chargebacks the club won).
  cashRefunded: number;
}

type PaymentLine = Pick<
  Payment,
  'kind' | 'amount' | 'payment_status' | 'payment_method'
>;

// Cash in and out, from the lines of the members' accounts.
export const cashFlowOf = (lines: PaymentLine[]): CashFlow => {
  let received = 0;
  let refunded = 0;
  for (const line of lines) {
    const cents = Math.round(Number(line.amount ?? 0) * 100);
    if (
      line.kind === PAYMENT_KIND.TOP_UP &&
      ['completed', 'refunded'].includes(line.payment_status)
    ) {
      received += cents;
    } else if (
      line.kind === PAYMENT_KIND.MANUAL_CREDIT &&
      CASH_METHODS.includes(line.payment_method)
    ) {
      received += cents;
    } else if (line.kind === PAYMENT_KIND.PROVIDER_REFUND) {
      refunded += cents;
    } else if (line.kind === PAYMENT_KIND.DISPUTE_WON) {
      refunded -= cents;
    }
  }
  return { cashReceived: received / 100, cashRefunded: refunded / 100 };
};

@Injectable()
export class FinancialService {
  private readonly exportsDir = join(__dirname, '../../uploads', 'exports');

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
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  // Money actually received from members over the period, as opposed to
  // revenue (flights charged to their accounts).
  async cashFlowForPeriod(start: Date, end: Date): Promise<CashFlow> {
    const lines = await this.paymentRepository.find({
      where: {
        payment_date: Between(start, end),
        kind: In([
          PAYMENT_KIND.TOP_UP,
          PAYMENT_KIND.MANUAL_CREDIT,
          PAYMENT_KIND.PROVIDER_REFUND,
          PAYMENT_KIND.DISPUTE_WON,
        ]),
      },
    });
    return cashFlowOf(lines ?? []);
  }

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
      ...ONLY_CHARGED_AMOUNT,
    });

    return chargedRevenue(reservations);
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
    // Only what was recorded as an expense (fuel included, when the club
    // enters its fuel bills): nothing is estimated.
    return parseFloat(expenseRaw.sum) || 0;
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
    cashReceived: number;
    cashRefunded: number;
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
      ...ONLY_CHARGED_AMOUNT,
    });

    const revenueForecast = chargedRevenue(reservations);

    const expenseRaw = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'sum')
      .where('expense.expense_date BETWEEN :start AND :end', {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      })
      .getRawOne();
    const recordedExpenses = parseFloat(expenseRaw.sum) || 0;

    // Expenses are the recorded ones only: no estimated fuel cost.
    const expenseForecast = recordedExpenses;

    const netForecast = revenueForecast - expenseForecast;

    const { cashReceived, cashRefunded } = await this.cashFlowForPeriod(
      startDate,
      endDate,
    );

    return {
      revenueForecast,
      expenseForecast,
      netForecast,
      cashReceived,
      cashRefunded,
    };
  }

  private writeExport(fileName: string, content: string | Uint8Array): void {
    mkdirSync(this.exportsDir, { recursive: true });
    writeFileSync(join(this.exportsDir, fileName), content);
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
      new Logger(FinancialService.name).warn(
        'Logo non trouvé, il sera ignoré.',
      );
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

    page.drawText(
      `Encaissements (rechargements, espèces, chèques, virements): ${forecast.cashReceived.toFixed(2)} €`,
      { x: 50, y: height - 230, size: 12, font },
    );
    page.drawText(
      `Remboursés par le prestataire de paiement: ${forecast.cashRefunded.toFixed(2)} €`,
      { x: 50, y: height - 246, size: 12, font },
    );

    let currentY = height - 280;

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
      const revenue = Number(res.charged_amount ?? 0);
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
      const line = `${exp.id}  |  ${exp.category}  |  ${exp.sub_category || '-'}  |  ${Number(exp.amount).toFixed(2)}  |  ${new Date(exp.expense_date).toISOString().substring(0, 10)}`;
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
    this.writeExport(fileName, pdfBytes);
    return `/uploads/exports/${fileName}`;
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
        cashReceived: forecast.cashReceived,
        cashRefunded: forecast.cashRefunded,
      },
    ];

    const fields = [
      'startDate',
      'endDate',
      'revenueForecast',
      'expenseForecast',
      'netForecast',
      'cashReceived',
      'cashRefunded',
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    const fileName = `financial-report-${startDate.getTime()}-${endDate.getTime()}.csv`;
    this.writeExport(fileName, csv);
    return `/uploads/exports/${fileName}`;
  }
}
