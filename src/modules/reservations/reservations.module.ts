import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationsResolver } from './reservations.resolver';

@Module({
  providers: [ReservationsService, ReservationsResolver]
})
export class ReservationsModule {}
