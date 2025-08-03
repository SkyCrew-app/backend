import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdministrationService } from './administration.service';
import { AdministrationResolver } from './administration.resolver';
import { Administration } from './entity/admin.entity';
import { User } from '../users/entity/users.entity';
import { Aircraft } from '../aircraft/entity/aircraft.entity';
import { Reservation } from '../reservations/entity/reservations.entity';
import { Flight } from '../flights/entity/flights.entity';
import { Incident } from '../incidents/entity/incidents.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Administration,
      User,
      Aircraft,
      Reservation,
      Flight,
      Incident,
    ]),
  ],
  providers: [AdministrationResolver, AdministrationService],
  exports: [AdministrationService],
})
export class AdministrationModule {}
