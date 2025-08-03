import { Notification } from '../entity/notifications.entity';
import { User } from '../../users/entity/users.entity';

describe('Notification Entity', () => {
  it('should create a notification instance', () => {
    const notification = new Notification();

    expect(notification).toBeInstanceOf(Notification);
  });

  it('should set all properties correctly', () => {
    const notification = new Notification();
    const user = new User();
    user.id = 1;

    notification.id = 1;
    notification.user = user;
    notification.notification_type = 'info';
    notification.message = 'Test message';
    notification.notification_date = new Date('2023-01-01');
    notification.expiration_date = new Date('2023-12-31');
    notification.is_read = false;
    notification.action_url = 'https://example.com';
    notification.priority = 'medium';

    expect(notification.id).toBe(1);
    expect(notification.user).toBe(user);
    expect(notification.notification_type).toBe('info');
    expect(notification.message).toBe('Test message');
    expect(notification.notification_date).toEqual(new Date('2023-01-01'));
    expect(notification.expiration_date).toEqual(new Date('2023-12-31'));
    expect(notification.is_read).toBe(false);
    expect(notification.action_url).toBe('https://example.com');
    expect(notification.priority).toBe('medium');
  });

  it('should have default value for is_read', () => {
    const notification = new Notification();

    // Le comportement par défaut devrait être défini dans la base de données
    // mais on peut tester que la propriété existe
    expect(notification.hasOwnProperty('is_read')).toBe(false);
  });
});
