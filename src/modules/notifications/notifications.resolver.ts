import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { NotificationsService } from './notifications.service';
import { Notification } from './entity/notifications.entity';
import { CreateNotificationInput } from './dto/create-notification.input';
import { UpdateNotificationInput } from './dto/update-notification.input';

@Resolver(() => Notification)
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Mutation(() => Notification, { name: 'createNotification' })
  async createNotification(
    @Args('createNotificationInput')
    createNotificationInput: CreateNotificationInput,
  ): Promise<Notification> {
    return await this.notificationsService.create(createNotificationInput);
  }

  @Query(() => [Notification], { name: 'notificationsByUser' })
  async notificationsByUser(
    @Args('userId', { type: () => Int }) userId: number,
  ): Promise<Notification[]> {
    return await this.notificationsService.findAllByUser(userId);
  }

  @Query(() => Notification, { name: 'notification' })
  async notification(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<Notification> {
    return await this.notificationsService.findOne(id);
  }

  @Mutation(() => Notification, { name: 'updateNotification' })
  async updateNotification(
    @Args('updateNotificationInput')
    updateNotificationInput: UpdateNotificationInput,
  ): Promise<Notification> {
    return await this.notificationsService.update(updateNotificationInput);
  }

  @Mutation(() => Boolean, { name: 'removeNotification' })
  async removeNotification(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    return await this.notificationsService.remove(id);
  }

  //seen notification
  @Mutation(() => Boolean, { name: 'seenNotification' })
  async seenNotification(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    return await this.notificationsService.seenNotification(id);
  }
}
