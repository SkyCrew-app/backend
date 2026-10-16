import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AirspaceEntity,
  NavdataCycle,
  NavPointEntity,
} from './entity/navdata.entity';
import { NavdataImportService } from './import/navdata-import.service';
import { NavdataResolver } from './navdata.resolver';
import { NavdataService } from './navdata.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NavdataCycle, NavPointEntity, AirspaceEntity]),
  ],
  providers: [NavdataService, NavdataImportService, NavdataResolver],
  exports: [NavdataService, NavdataImportService],
})
export class NavdataModule {}
