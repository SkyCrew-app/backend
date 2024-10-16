import { Module } from '@nestjs/common';
import { AircraftService } from './aircraft.service';
import { AircraftResolver } from './aircraft.resolver';
import { Aircraft } from './entity/aircraft.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { FileController } from '../../common/controllers/file.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Aircraft]),
    MulterModule.register({
      dest: './uploads',
    }),
  ],
  providers: [AircraftService, AircraftResolver],
  exports: [AircraftService],
  controllers: [FileController],
})
export class AircraftModule {}
