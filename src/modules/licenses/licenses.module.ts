import { Module } from '@nestjs/common';
import { LicensesService } from './licenses.service';
import { LicensesResolver } from './licenses.resolver';

@Module({
  providers: [LicensesService, LicensesResolver]
})
export class LicensesModule {}
