/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications.service';
import { Notification } from '../entity/notifications.entity';
import { NotificationsGateway } from '../notifications.gateway';
import { CreateNotificationInput } from '../dto/create-notification.input';
import { UpdateNotificationInput } from '../dto/update-notification.input';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repository: Repository<Notification>;
  let gateway: NotificationsGateway;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockGateway = {
    sendNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockRepository,
        },
        {
          provide: NotificationsGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    repository = module.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
    gateway = module.get<NotificationsGateway>(NotificationsGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a notification with provided date', async () => {
      const createInput: CreateNotificationInput = {
        user_id: 1,
        notification_type: 'info',
        message: 'Test message',
        notification_date: new Date('2023-01-01'),
        is_read: false,
      };

      const mockNotification = { id: 1, ...createInput };
      const expectedNotification = {
        ...createInput,
        user: { id: 1 },
        notification_date: createInput.notification_date,
      };

      mockRepository.create.mockReturnValue(expectedNotification);
      mockRepository.save.mockResolvedValue(mockNotification);

      const result = await service.create(createInput);

      expect(mockRepository.create).toHaveBeenCalledWith(expectedNotification);
      expect(mockRepository.save).toHaveBeenCalledWith(expectedNotification);
      expect(mockGateway.sendNotification).toHaveBeenCalledWith(
        1,
        mockNotification,
      );
      expect(result).toEqual(mockNotification);
    });

    it('should create notification with current date when no date provided', async () => {
      const createInput: CreateNotificationInput = {
        user_id: 1,
        notification_type: 'info',
        message: 'Test message',
        notification_date: undefined as any,
      };

      const mockNotification = { id: 1, ...createInput };
      const currentDate = new Date();

      jest.spyOn(global, 'Date').mockImplementation(() => currentDate as any);

      mockRepository.create.mockReturnValue({
        ...createInput,
        notification_date: currentDate,
      });
      mockRepository.save.mockResolvedValue(mockNotification);

      await service.create(createInput);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createInput,
        user: { id: 1 },
        notification_date: currentDate,
      });

      jest.restoreAllMocks();
    });
  });

  describe('findAllByUser', () => {
    it('should return notifications for a specific user ordered by date DESC', async () => {
      const userId = 1;
      const mockNotifications = [
        { id: 1, message: 'Notification 1' },
        { id: 2, message: 'Notification 2' },
      ];

      mockRepository.find.mockResolvedValue(mockNotifications);

      const result = await service.findAllByUser(userId);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { user: { id: userId } },
        order: { notification_date: 'DESC' },
      });
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('findOne', () => {
    it('should return a notification by id', async () => {
      const id = 1;
      const mockNotification = { id, message: 'Test notification' };

      mockRepository.findOne.mockResolvedValue(mockNotification);

      const result = await service.findOne(id);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id } });
      expect(result).toEqual(mockNotification);
    });
  });

  describe('update', () => {
    it('should update a notification and return the updated notification', async () => {
      const updateInput: UpdateNotificationInput = {
        id: 1,
        message: 'Updated message',
        is_read: true,
      };

      const updatedNotification = {
        id: 1,
        message: 'Updated message',
        is_read: true,
      };

      mockRepository.update.mockResolvedValue({ affected: 1 });
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(updatedNotification as any);

      const result = await service.update(updateInput);

      expect(mockRepository.update).toHaveBeenCalledWith(1, updateInput);
      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(updatedNotification);
    });
  });

  describe('remove', () => {
    it('should remove a notification and return true when successful', async () => {
      const id = 1;
      mockRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.remove(id);

      expect(mockRepository.delete).toHaveBeenCalledWith(id);
      expect(result).toBe(true);
    });

    it('should return false when no notification was affected', async () => {
      const id = 1;
      mockRepository.delete.mockResolvedValue({ affected: 0 });

      const result = await service.remove(id);

      expect(mockRepository.delete).toHaveBeenCalledWith(id);
      expect(result).toBe(false);
    });
  });

  describe('seenNotification', () => {
    it('should mark notification as read and return true', async () => {
      const id = 1;
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.seenNotification(id);

      expect(mockRepository.update).toHaveBeenCalledWith(id, { is_read: true });
      expect(result).toBe(true);
    });
  });
});
