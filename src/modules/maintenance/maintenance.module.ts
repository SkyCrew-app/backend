import { Module } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceResolver } from './maintenance.resolver';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Maintenance } from './entity/maintenance.entity';
import { AircraftModule } from '../aircraft/aircraft.module';
import { User } from '../users/entity/users.entity';
import { Aircraft } from '../aircraft/entity/aircraft.entity';

@Module({
  imports: [
    AircraftModule,
    TypeOrmModule.forFeature([Maintenance, Aircraft, User]),
  ],
  providers: [MaintenanceService, MaintenanceResolver],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
