import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsResolver } from '../notifications.resolver';
import { NotificationsService } from '../notifications.service';
import { CreateNotificationInput } from '../dto/create-notification.input';
import { UpdateNotificationInput } from '../dto/update-notification.input';

describe('NotificationsResolver', () => {
  let resolver: NotificationsResolver;

  const mockService = {
    create: jest.fn(),
    findAllByUser: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    seenNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsResolver,
        {
          provide: NotificationsService,
          useValue: mockService,
        },
      ],
    }).compile();

    resolver = module.get<NotificationsResolver>(NotificationsResolver);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('createNotification', () => {
    it('should create a notification', async () => {
      const createInput: CreateNotificationInput = {
        user_id: 1,
        notification_type: 'info',
        message: 'Test message',
        notification_date: new Date(),
      };

      const expectedNotification = { id: 1, ...createInput };
      mockService.create.mockResolvedValue(expectedNotification);

      const result = await resolver.createNotification(createInput);

      expect(mockService.create).toHaveBeenCalledWith(createInput);
      expect(result).toEqual(expectedNotification);
    });
  });

  describe('notificationsByUser', () => {
    it('should return notifications for a user', async () => {
      const userId = 1;
      const expectedNotifications = [
        { id: 1, message: 'Notification 1' },
        { id: 2, message: 'Notification 2' },
      ];

      mockService.findAllByUser.mockResolvedValue(expectedNotifications);

      const result = await resolver.notificationsByUser(userId);

      expect(mockService.findAllByUser).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedNotifications);
    });
  });

  describe('notification', () => {
    it('should return a single notification', async () => {
      const id = 1;
      const expectedNotification = { id, message: 'Test notification' };

      mockService.findOne.mockResolvedValue(expectedNotification);

      const result = await resolver.notification(id);

      expect(mockService.findOne).toHaveBeenCalledWith(id);
      expect(result).toEqual(expectedNotification);
    });
  });

  describe('updateNotification', () => {
    it('should update a notification', async () => {
      const updateInput: UpdateNotificationInput = {
        id: 1,
        message: 'Updated message',
      };

      const expectedNotification = { id: 1, message: 'Updated message' };
      mockService.update.mockResolvedValue(expectedNotification);

      const result = await resolver.updateNotification(updateInput);

      expect(mockService.update).toHaveBeenCalledWith(updateInput);
      expect(result).toEqual(expectedNotification);
    });
  });

  describe('removeNotification', () => {
    it('should remove a notification and return true', async () => {
      const id = 1;
      mockService.remove.mockResolvedValue(true);

      const result = await resolver.removeNotification(id);

      expect(mockService.remove).toHaveBeenCalledWith(id);
      expect(result).toBe(true);
    });

    it('should return false when removal fails', async () => {
      const id = 1;
      mockService.remove.mockResolvedValue(false);

      const result = await resolver.removeNotification(id);

      expect(mockService.remove).toHaveBeenCalledWith(id);
      expect(result).toBe(false);
    });
  });

  describe('seenNotification', () => {
    it('should mark notification as seen and return true', async () => {
      const id = 1;
      mockService.seenNotification.mockResolvedValue(true);

      const result = await resolver.seenNotification(id);

      expect(mockService.seenNotification).toHaveBeenCalledWith(id);
      expect(result).toBe(true);
    });
  });
});
