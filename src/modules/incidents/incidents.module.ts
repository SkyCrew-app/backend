import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incident } from './entity/incidents.entity';
import { Aircraft } from '../aircraft/entity/aircraft.entity';
import { Flight } from '../flights/entity/flights.entity';
import { User } from '../users/entity/users.entity';
import { Reservation } from '../reservations/entity/reservations.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { FlightsModule } from '../flights/flights.module';
import { IncidentsService } from './incidents.service';
import { IncidentsResolver } from './incidents.resolver';
import { AdminActionsModule } from '../../common/admin-actions/admin-actions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Incident, Aircraft, Flight, User, Reservation]),
    NotificationsModule,
    FlightsModule,
    AdminActionsModule,
  ],
  providers: [IncidentsService, IncidentsResolver],
  exports: [IncidentsService],
})
export class IncidentsModule {}
