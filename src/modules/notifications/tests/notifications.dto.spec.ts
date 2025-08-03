import { CreateNotificationInput } from '../dto/create-notification.input';

describe('CreateNotificationInput', () => {
  it('should be valid with all required fields', () => {
    const dto = new CreateNotificationInput();
    dto.user_id = 1;
    dto.notification_type = 'info';
    dto.message = 'Test message';
    dto.notification_date = new Date();

    expect(dto.user_id).toBe(1);
    expect(dto.notification_type).toBe('info');
    expect(dto.message).toBe('Test message');
    expect(dto.notification_date).toBeInstanceOf(Date);
  });

  it('should allow optional fields to be undefined', () => {
    const dto = new CreateNotificationInput();
    dto.user_id = 1;
    dto.notification_type = 'info';
    dto.message = 'Test message';
    dto.notification_date = new Date();
    // Optional fields not set

    expect(dto.expiration_date).toBeUndefined();
    expect(dto.is_read).toBeUndefined();
    expect(dto.action_url).toBeUndefined();
    expect(dto.priority).toBeUndefined();
  });

  it('should allow setting optional fields', () => {
    const dto = new CreateNotificationInput();
    dto.user_id = 1;
    dto.notification_type = 'warning';
    dto.message = 'Test message';
    dto.notification_date = new Date();
    dto.expiration_date = new Date();
    dto.is_read = false;
    dto.action_url = 'https://example.com';
    dto.priority = 'high';

    expect(dto.expiration_date).toBeInstanceOf(Date);
    expect(dto.is_read).toBe(false);
    expect(dto.action_url).toBe('https://example.com');
    expect(dto.priority).toBe('high');
  });
});

import { UpdateNotificationInput } from '../dto/update-notification.input';

describe('UpdateNotificationInput', () => {
  it('should be valid with required id field', () => {
    const dto = new UpdateNotificationInput();
    dto.id = 1;

    expect(dto.id).toBe(1);
  });

  it('should allow all fields to be optional except id', () => {
    const dto = new UpdateNotificationInput();
    dto.id = 1;
    // All other fields not set

    expect(dto.notification_type).toBeUndefined();
    expect(dto.message).toBeUndefined();
    expect(dto.notification_date).toBeUndefined();
    expect(dto.expiration_date).toBeUndefined();
    expect(dto.is_read).toBeUndefined();
    expect(dto.action_url).toBeUndefined();
    expect(dto.priority).toBeUndefined();
  });

  it('should allow setting optional fields', () => {
    const dto = new UpdateNotificationInput();
    dto.id = 1;
    dto.notification_type = 'error';
    dto.message = 'Updated message';
    dto.is_read = true;
    dto.priority = 'low';

    expect(dto.id).toBe(1);
    expect(dto.notification_type).toBe('error');
    expect(dto.message).toBe('Updated message');
    expect(dto.is_read).toBe(true);
    expect(dto.priority).toBe('low');
  });
});
