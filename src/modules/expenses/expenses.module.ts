import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesResolver } from './expenses.resolver';

@Module({
  providers: [ExpensesService, ExpensesResolver]
})
export class ExpensesModule {}
