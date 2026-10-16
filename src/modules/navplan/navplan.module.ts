import { Module, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AircraftDataModule } from '../aircraft/flight-data/aircraft-data.module';
import { FlightsModule } from '../flights/flights.module';
import { FlightsService } from '../flights/flights.service';
import { NavdataModule } from '../navdata/navdata.module';
import { Reservation } from '../reservations/entity/reservations.entity';
import { FlightPlanEntity } from './entity/flight-plan.entity';
import { FlightPlanningSettingsEntity } from './entity/flight-planning-settings.entity';
import { NavplanResolver } from './navplan.resolver';
import { NavplanService } from './navplan.service';
import { MetarTafService } from './weather/metar-taf.service';
import { WindsAloftService } from './weather/winds-aloft.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FlightPlanEntity,
      FlightPlanningSettingsEntity,
      Reservation,
    ]),
    NavdataModule,
    AircraftDataModule,
    FlightsModule,
  ],
  providers: [
    NavplanService,
    NavplanResolver,
    MetarTafService,
    WindsAloftService,
  ],
  exports: [NavplanService, MetarTafService, WindsAloftService],
})
export class NavplanModule implements OnModuleInit {
  constructor(private readonly moduleRef: ModuleRef) {}

  // The "generate a plan" of a booking (FlightsService.createFlightByAI)
  // is answered by this engine; the flights module does not depend on this
  // one, so the planner is handed over here.
  onModuleInit(): void {
    const flights = this.moduleRef.get(FlightsService, { strict: false });
    const navplan = this.moduleRef.get(NavplanService);
    flights.useDirectPlanner(
      (reservation, origin, destination, departure, altitude) =>
        navplan.directPlanForBooking(
          reservation,
          origin,
          destination,
          departure,
          altitude,
        ),
    );
  }
}
