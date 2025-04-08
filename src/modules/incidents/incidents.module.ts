import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incident } from './entity/incidents.entity';
import { Aircraft } from '../aircraft/entity/aircraft.entity';
import { Flight } from 'src/modules/flights/entity/flights.entity';
import { User } from 'src/modules/users/entity/users.entity';
import { IncidentsService } from './incidents.service';
import { IncidentsResolver } from './incidents.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([Incident, Aircraft, Flight, User])],
  providers: [IncidentsService, IncidentsResolver],
  exports: [IncidentsService],
})
export class IncidentsModule {}
