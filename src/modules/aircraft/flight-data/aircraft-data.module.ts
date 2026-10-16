import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Aircraft } from '../entity/aircraft.entity';
import {
  AircraftMassBalanceEntity,
  AircraftPerformanceEntity,
} from '../entity/aircraft-flight-data.entity';
import { AircraftDataResolver } from './aircraft-data.resolver';
import { AircraftDataService } from './aircraft-data.service';

// Flight manual data of the aircraft (performance, mass and balance).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Aircraft,
      AircraftPerformanceEntity,
      AircraftMassBalanceEntity,
    ]),
  ],
  providers: [AircraftDataService, AircraftDataResolver],
  exports: [AircraftDataService],
})
export class AircraftDataModule {}
