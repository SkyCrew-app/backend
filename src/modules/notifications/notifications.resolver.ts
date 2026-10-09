import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Notification } from './entity/notifications.entity';
import { CreateNotificationInput } from './dto/create-notification.input';
import { UpdateNotificationInput } from './dto/update-notification.input';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { assertSelfOrRole, SessionUser } from '../../common/auth/access';

@Resolver(() => Notification)
@UseGuards(JwtAuthGuard)
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  // A notification belongs to one user: only that user, or an
  // administrator, may read or change it.
  private async assertOwner(
    currentUser: SessionUser | undefined,
    notificationId: number,
  ): Promise<void> {
    const ownerId = await this.notificationsService.findOwnerId(notificationId);

    if (ownerId === null) {
      throw new NotFoundException('Notification not found');
    }

    assertSelfOrRole(currentUser, ownerId);
  }

  // The application creates notifications itself. Sending one by hand is
  // reserved to administrators.
  @Mutation(() => Notification, { name: 'createNotification' })
  @UseGuards(RolesGuard)
  @Roles('Administrateur')
  async createNotification(
    @Args('createNotificationInput')
    createNotificationInput: CreateNotificationInput,
  ): Promise<Notification> {
    return await this.notificationsService.create(createNotificationInput);
  }

  @Query(() => [Notification], { name: 'notificationsByUser' })
  async notificationsByUser(
    @Args('userId', { type: () => Int }) userId: number,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<Notification[]> {
    assertSelfOrRole(currentUser, userId);
    return await this.notificationsService.findAllByUser(userId);
  }

  @Query(() => Notification, { name: 'notification' })
  async notification(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<Notification> {
    await this.assertOwner(currentUser, id);
    return await this.notificationsService.findOne(id);
  }

  @Mutation(() => Notification, { name: 'updateNotification' })
  async updateNotification(
    @Args('updateNotificationInput')
    updateNotificationInput: UpdateNotificationInput,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<Notification> {
    await this.assertOwner(currentUser, updateNotificationInput.id);
    return await this.notificationsService.update(updateNotificationInput);
  }

  @Mutation(() => Boolean, { name: 'removeNotification' })
  async removeNotification(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<boolean> {
    await this.assertOwner(currentUser, id);
    return await this.notificationsService.remove(id);
  }

  @Mutation(() => Boolean, { name: 'seenNotification' })
  async seenNotification(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<boolean> {
    await this.assertOwner(currentUser, id);
    return await this.notificationsService.seenNotification(id);
  }
}
