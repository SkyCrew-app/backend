import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Notification } from './entity/notifications.entity';
import { CreateNotificationInput } from './dto/create-notification.input';
import { UpdateNotificationInput } from './dto/update-notification.input';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private notificationsGateway: NotificationsGateway,
  ) {}

  async create(
    createNotificationInput: CreateNotificationInput,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      ...createNotificationInput,
      user: { id: createNotificationInput.user_id },
      notification_date:
        createNotificationInput.notification_date || new Date(),
    });

    const savedNotification =
      await this.notificationRepository.save(notification);

    this.notificationsGateway.sendNotification(
      createNotificationInput.user_id,
      savedNotification,
    );

    return savedNotification;
  }

  // True when this user already received this exact notification. Several
  // messages may be given: the same text in each language it can have been
  // written in.
  async alreadySent(
    userId: number,
    notificationType: string,
    message: string | string[],
  ): Promise<boolean> {
    const count = await this.notificationRepository.count({
      where: {
        user: { id: userId },
        notification_type: notificationType,
        message: Array.isArray(message) ? In(message) : message,
      },
    });
    return count > 0;
  }

  async findAllByUser(userId: number): Promise<Notification[]> {
    return await this.notificationRepository.find({
      where: { user: { id: userId } },
      order: { notification_date: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Notification> {
    return await this.notificationRepository.findOne({ where: { id } });
  }

  // Id of the user a notification belongs to, or null if it does not exist.
  async findOwnerId(id: number): Promise<number | null> {
    const notification = await this.notificationRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    return notification?.user?.id ?? null;
  }

  async update(
    updateNotificationInput: UpdateNotificationInput,
  ): Promise<Notification> {
    await this.notificationRepository.update(
      updateNotificationInput.id,
      updateNotificationInput,
    );
    return await this.findOne(updateNotificationInput.id);
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.notificationRepository.delete(id);
    return result.affected > 0;
  }

  async seenNotification(id: number): Promise<boolean> {
    await this.notificationRepository.update(id, { is_read: true });
    return true;
  }

  // Marks every unread notification of the user as read, in one statement.
  async markAllRead(userId: number): Promise<number> {
    const result = await this.notificationRepository.update(
      { user: { id: userId }, is_read: false },
      { is_read: true },
    );
    return result.affected ?? 0;
  }

  async removeAllForUser(userId: number): Promise<number> {
    const result = await this.notificationRepository.delete({
      user: { id: userId },
    });
    return result.affected ?? 0;
  }
}
