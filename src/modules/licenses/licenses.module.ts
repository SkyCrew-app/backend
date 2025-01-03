import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LicensesService } from './licenses.service';
import { LicensesResolver } from './licenses.resolver';
import { License } from './entity/licenses.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([License]), UsersModule],
  providers: [LicensesService, LicensesResolver],
  exports: [LicensesService],
})
export class LicensesModule {}
