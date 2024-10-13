import { Module } from '@nestjs/common';
import { AircraftService } from './aircraft.service';
import { AircraftResolver } from './aircraft.resolver';

@Module({
  providers: [AircraftService, AircraftResolver]
})
export class AircraftModule {}
