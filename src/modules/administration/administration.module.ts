import { Module } from '@nestjs/common';
import { AdministrationService } from './administration.service';
import { AdministrationResolver } from './administration.resolver';

@Module({
  imports: [],
  providers: [AdministrationService, AdministrationResolver],
  exports: [AdministrationService],
})
export class AdministrationModule {}
