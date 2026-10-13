import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesService } from './roles.service';
import { RolesResolver } from './roles.resolver';
import { Role } from './entity/roles.entity';
import { AdminActionsModule } from '../../common/admin-actions/admin-actions.module';

@Module({
  imports: [TypeOrmModule.forFeature([Role]), AdminActionsModule],
  providers: [RolesService, RolesResolver],
})
export class RolesModule {}
