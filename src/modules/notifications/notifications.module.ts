import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsResolver } from './notifications.resolver';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entity/notifications.entity';
import { NotificationsGateway } from './notifications.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  providers: [
    NotificationsService,
    NotificationsResolver,
    NotificationsGateway,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
