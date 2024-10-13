import { Module } from '@nestjs/common';
import { FlightsService } from './flights.service';
import { FlightsResolver } from './flights.resolver';

@Module({
  providers: [FlightsService, FlightsResolver]
})
export class FlightsModule {}
