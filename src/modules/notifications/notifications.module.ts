import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsResolver } from './notifications.resolver';

@Module({
  providers: [NotificationsService, NotificationsResolver]
})
export class NotificationsModule {}
