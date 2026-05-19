import { User } from '../entity/users.entity';
import { UserProgress } from '../entity/user-progress.entity';
import { Role } from '../../roles/entity/roles.entity';

describe('User Entity - UserProgress Relations', () => {
  it('should create user with user progresses', () => {
    const user = new User();
    const progress1 = new UserProgress();
    const progress2 = new UserProgress();

    progress1.id = 1;
    progress2.id = 2;

    user.id = 1;
    user.userProgresses = [progress1, progress2];

    expect(user.userProgresses).toHaveLength(2);
    expect(user.userProgresses[0]).toBe(progress1);
    expect(user.userProgresses[1]).toBe(progress2);
  });

  it('should set all required user properties', () => {
    const user = new User();
    const role = new Role();

    user.id = 1;
    user.first_name = 'John';
    user.last_name = 'Doe';
    user.email = 'john.doe@example.com';
    user.date_of_birth = new Date('1990-01-01');
    user.user_account_balance = 1500.5;
    user.role = role;

    expect(user.id).toBe(1);
    expect(user.first_name).toBe('John');
    expect(user.last_name).toBe('Doe');
    expect(user.email).toBe('john.doe@example.com');
    expect(user.user_account_balance).toBe(1500.5);
    expect(user.role).toBe(role);
  });

  it('should handle optional user fields', () => {
    const user = new User();

    user.password = null;
    user.phone_number = null;
    user.address = null;
    user.profile_picture = null;
    user.total_flight_hours = null;

    expect(user.password).toBeNull();
    expect(user.phone_number).toBeNull();
    expect(user.address).toBeNull();
  });

  it('should handle boolean defaults correctly', () => {
    const user = new User();

    // Test des valeurs par défaut
    user.is2FAEnabled = false;
    user.isEmailConfirmed = false;
    user.email_notifications_enabled = true;
    user.sms_notifications_enabled = false;
    user.newsletter_subscribed = true;

    expect(user.is2FAEnabled).toBe(false);
    expect(user.isEmailConfirmed).toBe(false);
    expect(user.email_notifications_enabled).toBe(true);
    expect(user.sms_notifications_enabled).toBe(false);
    expect(user.newsletter_subscribed).toBe(true);
  });

  it('should handle user preferences', () => {
    const user = new User();

    user.language = 'fr';
    user.speed_unit = 'kph';
    user.distance_unit = 'km';
    user.timezone = 'Europe/Paris';
    user.preferred_aerodrome = 'LFPG';

    expect(user.language).toBe('fr');
    expect(user.speed_unit).toBe('kph');
    expect(user.distance_unit).toBe('km');
    expect(user.timezone).toBe('Europe/Paris');
    expect(user.preferred_aerodrome).toBe('LFPG');
  });

  it('should handle account balance with precision', () => {
    const user = new User();

    user.user_account_balance = 1234.56;
    expect(user.user_account_balance).toBe(1234.56);

    user.user_account_balance = 0.01;
    expect(user.user_account_balance).toBe(0.01);

    user.user_account_balance = -50.25;
    expect(user.user_account_balance).toBe(-50.25);
  });

  it('should handle user progress array operations', () => {
    const user = new User();
    const progress1 = new UserProgress();
    const progress2 = new UserProgress();

    progress1.id = 1;
    progress2.id = 2;

    // Initialiser avec un tableau vide
    user.userProgresses = [];
    expect(user.userProgresses).toHaveLength(0);

    // Ajouter des progrès
    user.userProgresses.push(progress1, progress2);
    expect(user.userProgresses).toHaveLength(2);

    // Filtrer les progrès
    user.userProgresses = user.userProgresses.filter((p) => p.id !== 1);
    expect(user.userProgresses).toHaveLength(1);
    expect(user.userProgresses[0]).toBe(progress2);
  });
});
