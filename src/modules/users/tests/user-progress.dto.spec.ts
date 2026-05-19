import { CreateUserProgressDTO } from '../dto/create-user-progress.input';

describe('CreateUserProgressDTO', () => {
  it('should create instance with all required fields', () => {
    const dto = new CreateUserProgressDTO();
    dto.userId = 1;
    dto.lessonId = 1;

    expect(dto.userId).toBe(1);
    expect(dto.lessonId).toBe(1);
  });

  it('should accept valid user and lesson IDs', () => {
    const dto = new CreateUserProgressDTO();
    dto.userId = 123;
    dto.lessonId = 456;

    expect(dto.userId).toBe(123);
    expect(dto.lessonId).toBe(456);
  });

  it('should have number type for both IDs', () => {
    const dto = new CreateUserProgressDTO();
    dto.userId = 1;
    dto.lessonId = 2;

    expect(typeof dto.userId).toBe('number');
    expect(typeof dto.lessonId).toBe('number');
  });
});

import { UpdateUserProgressDTO } from '../dto/update-user-progress.input';

describe('UpdateUserProgressDTO', () => {
  it('should extend CreateUserProgressDTO with additional fields', () => {
    const dto = new UpdateUserProgressDTO();
    dto.userId = 1;
    dto.lessonId = 2;
    dto.completed = true;
    dto.completed_at = new Date();

    expect(dto.userId).toBe(1);
    expect(dto.lessonId).toBe(2);
    expect(dto.completed).toBe(true);
    expect(dto.completed_at).toBeInstanceOf(Date);
  });

  it('should allow partial updates with only new fields', () => {
    const dto = new UpdateUserProgressDTO();
    dto.completed = true;
    dto.completed_at = new Date('2023-12-01T10:00:00Z');

    expect(dto.completed).toBe(true);
    expect(dto.completed_at).toEqual(new Date('2023-12-01T10:00:00Z'));
    expect(dto.userId).toBeUndefined();
    expect(dto.lessonId).toBeUndefined();
  });

  it('should handle completion states correctly', () => {
    const dto = new UpdateUserProgressDTO();

    // Marquer comme complété
    dto.completed = true;
    dto.completed_at = new Date();
    expect(dto.completed).toBe(true);
    expect(dto.completed_at).toBeInstanceOf(Date);

    // Marquer comme non complété
    dto.completed = false;
    dto.completed_at = undefined;
    expect(dto.completed).toBe(false);
    expect(dto.completed_at).toBeUndefined();
  });

  it('should allow completed_at without completed flag', () => {
    const dto = new UpdateUserProgressDTO();
    const completionDate = new Date('2023-12-01T15:30:00Z');
    dto.completed_at = completionDate;

    expect(dto.completed_at).toEqual(completionDate);
    expect(dto.completed).toBeUndefined();
  });

  it('should handle timezone in completion date', () => {
    const dto = new UpdateUserProgressDTO();
    const utcDate = new Date('2023-12-01T10:00:00Z');
    const localDate = new Date('2023-12-01T15:00:00+05:00');

    dto.completed_at = utcDate;
    expect(dto.completed_at).toEqual(utcDate);

    dto.completed_at = localDate;
    expect(dto.completed_at).toEqual(localDate);
  });
});
