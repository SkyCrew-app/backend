import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { FinancialReport } from './entity/financial-report.entity';
import { Expense } from './entity/expense.entity';
import { CreateFinancialReportInput } from './dto/create-financial-report.dto';
import { UpdateFinancialReportInput } from './dto/update-financial-report.dto';
import { CreateExpenseInput } from './dto/create-expense.dto';
import { UpdateExpenseInput } from './dto/update-expense.dto';
import { FinancialService } from './financial.service';
import { ObjectType } from '@nestjs/graphql';
import { Field, Float } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ObjectType()
export class BudgetForecast {
  @Field(() => Float)
  revenueForecast: number;

  @Field(() => Float)
  expenseForecast: number;

  @Field(() => Float)
  netForecast: number;
}

@Resolver()
export class FinancialResolver {
  constructor(private readonly financialService: FinancialService) {}

  @Query(() => [FinancialReport], { name: 'financialReports' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async getFinancialReports(): Promise<FinancialReport[]> {
    return this.financialService.findAllFinancialReports();
  }

  @Query(() => FinancialReport, { name: 'financialReport' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async getFinancialReport(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<FinancialReport> {
    return this.financialService.findFinancialReport(id);
  }

  @Mutation(() => FinancialReport, { name: 'createFinancialReport' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async createFinancialReport(
    @Args('createFinancialReportInput')
    createFinancialReportInput: CreateFinancialReportInput,
  ): Promise<FinancialReport> {
    return this.financialService.createFinancialReport(
      createFinancialReportInput,
    );
  }

  @Mutation(() => FinancialReport, { name: 'updateFinancialReport' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async updateFinancialReport(
    @Args('updateFinancialReportInput')
    updateFinancialReportInput: UpdateFinancialReportInput,
  ): Promise<FinancialReport> {
    return this.financialService.updateFinancialReport(
      updateFinancialReportInput,
    );
  }

  @Mutation(() => Boolean, { name: 'removeFinancialReport' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async removeFinancialReport(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    return this.financialService.removeFinancialReport(id);
  }

  @Query(() => [Expense], { name: 'expenses' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async getExpenses(): Promise<Expense[]> {
    return this.financialService.findAllExpenses();
  }

  @Query(() => Expense, { name: 'expense' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async getExpense(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<Expense> {
    return this.financialService.findExpense(id);
  }

  @Query(() => [Expense], { name: 'expenseByPeriod' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async getExpenseByPeriod(
    @Args('startDate', { type: () => Date }) startDate: Date,
    @Args('endDate', { type: () => Date }) endDate: Date,
  ): Promise<Expense[]> {
    return this.financialService.findExpenseByPeriod(startDate, endDate);
  }

  @Mutation(() => Expense, { name: 'createExpense' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async createExpense(
    @Args('createExpenseInput')
    createExpenseInput: CreateExpenseInput,
  ): Promise<Expense> {
    return this.financialService.createExpense(createExpenseInput);
  }

  @Mutation(() => Expense, { name: 'updateExpense' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async updateExpense(
    @Args('updateExpenseInput')
    updateExpenseInput: UpdateExpenseInput,
  ): Promise<Expense> {
    return this.financialService.updateExpense(updateExpenseInput);
  }

  @Mutation(() => Boolean, { name: 'removeExpense' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async removeExpense(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    return this.financialService.removeExpense(id);
  }

  @Query(() => BudgetForecast, { name: 'generateBudgetForecast' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async generateBudgetForecast(
    @Args('startDate', { type: () => Date }) startDate: Date,
    @Args('endDate', { type: () => Date }) endDate: Date,
  ): Promise<BudgetForecast> {
    const result = await this.financialService.generateBudgetForecast(
      startDate,
      endDate,
    );
    return Object.assign(new BudgetForecast(), result);
  }

  @Mutation(() => String, { name: 'generatePdfFinancialReport' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async generateFinancialReportPDFByPeriod(
    @Args('startDate', { type: () => Date }) startDate: Date,
    @Args('endDate', { type: () => Date }) endDate: Date,
  ): Promise<string> {
    await this.financialService.generateFinancialReportByPeriodPDF(
      startDate,
      endDate,
    );

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const fileName = `financial-report-${startDate.getTime()}-${endDate.getTime()}.pdf`;
    const downloadUrl = `${baseUrl}/${fileName}`;
    return downloadUrl;
  }

  @Mutation(() => String, { name: 'generateCsvFinancialReport' })
  async generateFinancialReportCSVByPeriod(
    @Args('startDate', { type: () => Date }) startDate: Date,
    @Args('endDate', { type: () => Date }) endDate: Date,
  ): Promise<string> {
    await this.financialService.generateFinancialReportByPeriodCSV(
      startDate,
      endDate,
    );

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const fileName = `financial-report-${startDate.getTime()}-${endDate.getTime()}.csv`;
    const downloadUrl = `${baseUrl}/${fileName}`;
    return downloadUrl;
  }
}
