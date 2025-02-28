import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async findAllByUser(userId: number): Promise<Notification[]> {
    return await this.notificationRepository.find({
      where: { user: { id: userId } },
      order: { notification_date: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Notification> {
    return await this.notificationRepository.findOne({ where: { id } });
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
}
