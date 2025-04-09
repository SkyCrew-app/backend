import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditResolver } from './audit.resolver';
import { Audit } from './entity/audit.entity';
import { AuditItem } from './entity/audit-item.entity';
import { AuditTemplate } from './entity/audit-template.entity';
import { AuditTemplateItem } from './entity/audit-template-item.entity';
import { AircraftModule } from '../aircraft/aircraft.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Audit,
      AuditItem,
      AuditTemplate,
      AuditTemplateItem,
    ]),
    AircraftModule,
    UsersModule,
  ],
  providers: [AuditService, AuditResolver],
  exports: [AuditService],
})
export class AuditModule {}
