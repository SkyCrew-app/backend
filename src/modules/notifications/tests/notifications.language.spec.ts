import { In } from 'typeorm';
import { NotificationsService } from '../notifications.service';

describe('NotificationsService alreadySent', () => {
  let service: NotificationsService;
  let repository: { count: jest.Mock };

  beforeEach(() => {
    repository = { count: jest.fn().mockResolvedValue(0) };
    service = new NotificationsService(repository as any, {} as any);
  });

  it('looks for the exact message', async () => {
    await expect(service.alreadySent(3, 'KIND', 'Bonjour')).resolves.toBe(
      false,
    );

    expect(repository.count).toHaveBeenCalledWith({
      where: { user: { id: 3 }, notification_type: 'KIND', message: 'Bonjour' },
    });
  });

  it('recognises the message in any of the languages it may be written in', async () => {
    repository.count.mockResolvedValue(1);

    await expect(
      service.alreadySent(3, 'KIND', ['Bonjour', 'Hello']),
    ).resolves.toBe(true);

    expect(repository.count).toHaveBeenCalledWith({
      where: {
        user: { id: 3 },
        notification_type: 'KIND',
        message: In(['Bonjour', 'Hello']),
      },
    });
  });
});
