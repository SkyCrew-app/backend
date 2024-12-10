import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdministrationService } from './administration.service';
import { AdministrationResolver } from './administration.resolver';
import { Administration } from './entity/admin.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Administration])],
  providers: [AdministrationResolver, AdministrationService],
  exports: [AdministrationService],
})
export class AdministrationModule {}
