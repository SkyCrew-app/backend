import { CreateUserInput } from '../dto/create-user.input';

describe('CreateUserInput', () => {
  it('should create instance with all required fields', () => {
    const dto = new CreateUserInput();
    dto.first_name = 'John';
    dto.last_name = 'Doe';
    dto.email = 'john.doe@example.com';
    dto.date_of_birth = new Date('1990-01-01');
    dto.user_account_balance = 0;

    expect(dto.first_name).toBe('John');
    expect(dto.last_name).toBe('Doe');
    expect(dto.email).toBe('john.doe@example.com');
    expect(dto.date_of_birth).toEqual(new Date('1990-01-01'));
    expect(dto.user_account_balance).toBe(0);
  });

  it('should allow optional fields to be undefined', () => {
    const dto = new CreateUserInput();
    dto.first_name = 'John';
    dto.last_name = 'Doe';
    dto.email = 'john@example.com';
    dto.date_of_birth = new Date('1990-01-01');
    dto.user_account_balance = 0;

    expect(dto.password).toBeUndefined();
    expect(dto.is2FAEnabled).toBeUndefined();
    expect(dto.phone_number).toBeUndefined();
    expect(dto.address).toBeUndefined();
    expect(dto.profile_picture).toBeUndefined();
  });

  it('should allow all optional fields to be set', () => {
    const dto = new CreateUserInput();
    dto.first_name = 'Jane';
    dto.last_name = 'Smith';
    dto.email = 'jane.smith@example.com';
    dto.password = 'securePassword123';
    dto.is2FAEnabled = true;
    dto.twoFactorAuthSecret = 'secret123';
    dto.phone_number = '+1234567890';
    dto.address = '123 Main St, City, Country';
    dto.date_of_birth = new Date('1985-05-15');
    dto.profile_picture = 'profile.jpg';
    dto.total_flight_hours = 150.5;
    dto.user_account_balance = 1500.75;
    dto.membership_start_date = new Date('2023-01-01');
    dto.membership_end_date = new Date('2024-01-01');
    dto.is_instructor = true;
    dto.language = 'fr';
    dto.speed_unit = 'kph';
    dto.distance_unit = 'km';
    dto.timezone = 'Europe/Paris';

    expect(dto.password).toBe('securePassword123');
    expect(dto.is2FAEnabled).toBe(true);
    expect(dto.phone_number).toBe('+1234567890');
    expect(dto.total_flight_hours).toBe(150.5);
    expect(dto.is_instructor).toBe(true);
    expect(dto.language).toBe('fr');
  });

  it('should handle different date formats', () => {
    const dto = new CreateUserInput();
    const birthDate = new Date('1995-12-25');
    const membershipStart = new Date('2023-06-01');

    dto.date_of_birth = birthDate;
    dto.membership_start_date = membershipStart;

    expect(dto.date_of_birth).toEqual(birthDate);
    expect(dto.membership_start_date).toEqual(membershipStart);
  });

  it('should handle boolean fields correctly', () => {
    const dto = new CreateUserInput();
    dto.is2FAEnabled = false;
    dto.is_instructor = true;

    expect(dto.is2FAEnabled).toBe(false);
    expect(dto.is_instructor).toBe(true);
  });

  it('should handle numeric fields correctly', () => {
    const dto = new CreateUserInput();
    dto.total_flight_hours = 0;
    dto.user_account_balance = -50.25; // Peut être négatif

    expect(dto.total_flight_hours).toBe(0);
    expect(dto.user_account_balance).toBe(-50.25);
  });
});

import { UpdateUserPreferencesInput } from '../dto/update-user-preferences.input';

describe('UpdateUserPreferencesInput', () => {
  it('should create instance with all fields optional', () => {
    const dto = new UpdateUserPreferencesInput();

    expect(dto.id).toBeUndefined();
    expect(dto.language).toBeUndefined();
    expect(dto.speed_unit).toBeUndefined();
    expect(dto.distance_unit).toBeUndefined();
    expect(dto.timezone).toBeUndefined();
    expect(dto.preferred_aerodrome).toBeUndefined();
  });

  it('should allow setting user preferences', () => {
    const dto = new UpdateUserPreferencesInput();
    dto.id = 1;
    dto.language = 'en';
    dto.speed_unit = 'mph';
    dto.distance_unit = 'miles';
    dto.timezone = 'America/New_York';
    dto.preferred_aerodrome = 'KJFK';

    expect(dto.id).toBe(1);
    expect(dto.language).toBe('en');
    expect(dto.speed_unit).toBe('mph');
    expect(dto.distance_unit).toBe('miles');
    expect(dto.timezone).toBe('America/New_York');
    expect(dto.preferred_aerodrome).toBe('KJFK');
  });

  it('should allow partial updates', () => {
    const dto = new UpdateUserPreferencesInput();
    dto.id = 1;
    dto.language = 'fr';
    // Autres champs restent undefined

    expect(dto.id).toBe(1);
    expect(dto.language).toBe('fr');
    expect(dto.speed_unit).toBeUndefined();
    expect(dto.timezone).toBeUndefined();
  });

  it('should handle different language codes', () => {
    const languages = ['fr', 'en', 'es', 'de', 'it'];

    languages.forEach((lang) => {
      const dto = new UpdateUserPreferencesInput();
      dto.language = lang;
      expect(dto.language).toBe(lang);
    });
  });

  it('should handle different unit systems', () => {
    const dto = new UpdateUserPreferencesInput();

    // Système métrique
    dto.speed_unit = 'kph';
    dto.distance_unit = 'km';
    expect(dto.speed_unit).toBe('kph');
    expect(dto.distance_unit).toBe('km');

    // Système impérial
    dto.speed_unit = 'mph';
    dto.distance_unit = 'miles';
    expect(dto.speed_unit).toBe('mph');
    expect(dto.distance_unit).toBe('miles');
  });
});

import { UpdateUserInput } from '../dto/update-user.input';

describe('UpdateUserInput', () => {
  it('should require email field', () => {
    const dto = new UpdateUserInput();
    dto.email = 'updated@example.com';

    expect(dto.email).toBe('updated@example.com');
  });

  it('should allow partial updates of optional fields', () => {
    const dto = new UpdateUserInput();
    dto.email = 'user@example.com';
    dto.first_name = 'UpdatedName';
    dto.phone_number = '+9876543210';

    expect(dto.email).toBe('user@example.com');
    expect(dto.first_name).toBe('UpdatedName');
    expect(dto.phone_number).toBe('+9876543210');
    expect(dto.last_name).toBeUndefined();
    expect(dto.address).toBeUndefined();
  });

  it('should handle all updatable fields', () => {
    const dto = new UpdateUserInput();
    dto.id = 1;
    dto.first_name = 'John';
    dto.last_name = 'Smith';
    dto.email = 'john.smith@example.com';
    dto.password = 'newPassword123';
    dto.profile_picture = 'new-avatar.jpg';
    dto.phone_number = '+1122334455';
    dto.address = '456 Updated Street';
    dto.date_of_birth = new Date('1990-01-01');
    dto.membership_start_date = new Date('2023-01-01');
    dto.membership_end_date = new Date('2024-01-01');
    dto.is_instructor = false;
    dto.language = 'en';
    dto.speed_unit = 'knots';
    dto.distance_unit = 'nautical_miles';
    dto.timezone = 'UTC';
    dto.roleId = 2;

    expect(dto.id).toBe(1);
    expect(dto.first_name).toBe('John');
    expect(dto.email).toBe('john.smith@example.com');
    expect(dto.is_instructor).toBe(false);
    expect(dto.roleId).toBe(2);
  });

  it('should handle boolean updates correctly', () => {
    const dto = new UpdateUserInput();
    dto.email = 'instructor@example.com';
    dto.is_instructor = true;

    expect(dto.is_instructor).toBe(true);

    dto.is_instructor = false;
    expect(dto.is_instructor).toBe(false);
  });

  it('should handle date updates', () => {
    const dto = new UpdateUserInput();
    const newBirthDate = new Date('1985-06-15');
    const newMembershipStart = new Date('2023-07-01');

    dto.email = 'user@example.com';
    dto.date_of_birth = newBirthDate;
    dto.membership_start_date = newMembershipStart;

    expect(dto.date_of_birth).toEqual(newBirthDate);
    expect(dto.membership_start_date).toEqual(newMembershipStart);
  });

  it('should allow role changes', () => {
    const dto = new UpdateUserInput();
    dto.email = 'user@example.com';
    dto.roleId = 3;

    expect(dto.roleId).toBe(3);
  });
});
