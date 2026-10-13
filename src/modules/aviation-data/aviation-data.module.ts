import { Module } from '@nestjs/common';
import { AviationDataResolver } from './aviation-data.resolver';
import { AviationDataService } from './aviation-data.service';

@Module({
  providers: [AviationDataResolver, AviationDataService],
})
export class AviationDataModule {}
