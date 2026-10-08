import { Module } from '@nestjs/common';
import { FlightsService } from './flights.service';
import { FlightsResolver } from './flights.resolver';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flight } from './entity/flights.entity';
import { Reservation } from '../reservations/entity/reservations.entity';
import { User } from '../users/entity/users.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AirportsService } from './airports.service';
import { FlightPlanGeneratorService } from './flight-plan-generator.service';
import { AirwayGraphService } from './airway-graph.service';
import { AircraftPerformanceService } from './aircraft-performance.service';
import { MetarService } from './metar.service';
import { LogbookService } from './logbook.service';
import { LogbookResolver } from './logbook.resolver';

@Module({
  imports: [
    TypeOrmModule.forFeature([Flight, Reservation, User]),
    NotificationsModule,
  ],
  exports: [FlightsService, LogbookService],
  providers: [
    FlightsService,
    FlightsResolver,
    AirportsService,
    FlightPlanGeneratorService,
    AirwayGraphService,
    AircraftPerformanceService,
    MetarService,
    LogbookService,
    LogbookResolver,
  ],
})
export class FlightsModule {}
