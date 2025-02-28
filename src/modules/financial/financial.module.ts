import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancialReport } from './entity/financial-report.entity';
import { Expense } from './entity/expense.entity';
import { FinancialService } from './financial.service';
import { FinancialResolver } from './financial.resolver';
import { AircraftModule } from '../aircraft/aircraft.module';
import { Aircraft } from '../aircraft/entity/aircraft.entity';
import { Reservation } from '../reservations/entity/reservations.entity';
import { Administration } from '../administration/entity/admin.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinancialReport,
      Expense,
      Aircraft,
      Reservation,
      Administration,
    ]),
    AircraftModule,
  ],
  providers: [FinancialService, FinancialResolver],
  exports: [FinancialService],
})
export class FinancialModule {}
