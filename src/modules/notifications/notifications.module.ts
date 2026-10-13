import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsResolver } from './notifications.resolver';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entity/notifications.entity';
import { NotificationsGateway } from './notifications.gateway';
import { User } from '../users/entity/users.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, User])],
  providers: [
    NotificationsService,
    NotificationsResolver,
    NotificationsGateway,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
