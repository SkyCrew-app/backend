import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LicensesService } from './licenses.service';
import { LicensesResolver } from './licenses.resolver';
import { License } from './entity/licenses.entity';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailerModule } from '../mail/mailer.module';
import { LicenceRemindersService } from './licence-reminders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([License]),
    UsersModule,
    NotificationsModule,
    MailerModule,
  ],
  providers: [LicensesService, LicensesResolver, LicenceRemindersService],
  exports: [LicensesService, LicenceRemindersService],
})
export class LicensesModule {}
