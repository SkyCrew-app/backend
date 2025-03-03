import { Module } from '@nestjs/common';
import { FlightsService } from './flights.service';
import { FlightsResolver } from './flights.resolver';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flight } from './entity/flights.entity';
import { Reservation } from '../reservations/entity/reservations.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AirportsService } from './airports.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    TypeOrmModule.forFeature([Flight, Reservation]),
    NotificationsModule,
    HttpModule,
  ],
  exports: [FlightsService],
  providers: [FlightsService, FlightsResolver, AirportsService],
})
export class FlightsModule {}
