import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationsService } from './reservations.service';
import { ReservationsResolver } from './reservations.resolver';
import { Reservation } from './entity/reservations.entity';
import { MailerModule } from '../mail/mailer.module';
import { User } from '../users/entity/users.entity';
import { Aircraft } from '../aircraft/entity/aircraft.entity';
import { AdministrationModule } from '../administration/administration.module';
import { FlightsModule } from '../flights/flights.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, User, Aircraft]),
    MailerModule,
    AdministrationModule,
    FlightsModule,
    PaymentsModule,
  ],
  providers: [ReservationsService, ReservationsResolver],
  exports: [ReservationsService],
})
export class ReservationsModule {}
