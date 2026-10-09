import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsResolver } from '../notifications.resolver';
import { NotificationsService } from '../notifications.service';
import { CreateNotificationInput } from '../dto/create-notification.input';
import { UpdateNotificationInput } from '../dto/update-notification.input';

const admin = {
  id: 1,
  email: 'admin@example.com',
  role: { role_name: 'Administrateur' },
};
const owner = {
  id: 3,
  email: 'owner@example.com',
  role: { role_name: 'Pilote' },
};
const stranger = {
  id: 7,
  email: 'stranger@example.com',
  role: { role_name: 'Pilote' },
};

describe('NotificationsResolver', () => {
  let resolver: NotificationsResolver;

  const mockService = {
    create: jest.fn(),
    findAllByUser: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    seenNotification: jest.fn(),
    findOwnerId: jest.fn(),
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

  beforeEach(() => {
    // By default the notification exists and belongs to user 3.
    mockService.findOwnerId.mockResolvedValue(3);
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

      const result = await resolver.notificationsByUser(userId, admin);

      expect(mockService.findAllByUser).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedNotifications);
    });
  });

  describe('notification', () => {
    it('should return a single notification', async () => {
      const id = 1;
      const expectedNotification = { id, message: 'Test notification' };

      mockService.findOne.mockResolvedValue(expectedNotification);

      const result = await resolver.notification(id, admin);

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

      const result = await resolver.updateNotification(updateInput, admin);

      expect(mockService.update).toHaveBeenCalledWith(updateInput);
      expect(result).toEqual(expectedNotification);
    });
  });

  describe('removeNotification', () => {
    it('should remove a notification and return true', async () => {
      const id = 1;
      mockService.remove.mockResolvedValue(true);

      const result = await resolver.removeNotification(id, admin);

      expect(mockService.remove).toHaveBeenCalledWith(id);
      expect(result).toBe(true);
    });

    it('should return false when removal fails', async () => {
      const id = 1;
      mockService.remove.mockResolvedValue(false);

      const result = await resolver.removeNotification(id, admin);

      expect(mockService.remove).toHaveBeenCalledWith(id);
      expect(result).toBe(false);
    });
  });

  describe('seenNotification', () => {
    it('should mark notification as seen and return true', async () => {
      const id = 1;
      mockService.seenNotification.mockResolvedValue(true);

      const result = await resolver.seenNotification(id, admin);

      expect(mockService.seenNotification).toHaveBeenCalledWith(id);
      expect(result).toBe(true);
    });
  });
  describe('authorization', () => {
    it("refuses a member reading another user's notifications", async () => {
      await expect(resolver.notificationsByUser(3, stranger)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockService.findAllByUser).not.toHaveBeenCalled();
    });

    it('lets a member read their own notifications', async () => {
      mockService.findAllByUser.mockResolvedValue([{ id: 1 }]);

      await expect(resolver.notificationsByUser(3, owner)).resolves.toEqual([
        { id: 1 },
      ]);
    });

    const onOneNotification: Array<
      [string, (caller: any) => Promise<unknown>]
    > = [
      ['notification', (caller) => resolver.notification(10, caller)],
      [
        'updateNotification',
        (caller) =>
          resolver.updateNotification({ id: 10, message: 'x' }, caller),
      ],
      [
        'removeNotification',
        (caller) => resolver.removeNotification(10, caller),
      ],
      ['seenNotification', (caller) => resolver.seenNotification(10, caller)],
    ];

    it.each(onOneNotification)(
      '%s refuses a member who does not own the notification',
      async (_name, call) => {
        await expect(call(stranger)).rejects.toThrow(ForbiddenException);
        expect(mockService.update).not.toHaveBeenCalled();
        expect(mockService.remove).not.toHaveBeenCalled();
        expect(mockService.seenNotification).not.toHaveBeenCalled();
      },
    );

    it.each(onOneNotification)('%s accepts the owner', async (_name, call) => {
      mockService.findOne.mockResolvedValue({ id: 10 });
      mockService.update.mockResolvedValue({ id: 10 });
      mockService.remove.mockResolvedValue(true);
      mockService.seenNotification.mockResolvedValue(true);

      await expect(call(owner)).resolves.toBeDefined();
      expect(mockService.findOwnerId).toHaveBeenCalledWith(10);
    });

    it.each(onOneNotification)(
      '%s answers not found for an unknown notification',
      async (_name, call) => {
        mockService.findOwnerId.mockResolvedValue(null);

        await expect(call(owner)).rejects.toThrow(NotFoundException);
      },
    );
  });
});
