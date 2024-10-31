import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationsService } from './reservations.service';
import { ReservationsResolver } from './reservations.resolver';
import { Reservation } from './entity/reservations.entity';
import { MailerModule } from '../mail/mailer.module';
import { User } from '../users/entity/users.entity';
import { Aircraft } from '../aircraft/entity/aircraft.entity';
import { WhatsAppService } from 'src/utils/whatsapp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, User, Aircraft]),
    MailerModule,
  ],
  providers: [ReservationsService, ReservationsResolver, WhatsAppService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
