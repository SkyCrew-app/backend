import { DataSource, Repository } from 'typeorm';
import { User } from '../../modules/users/entity/users.entity';
import { Role } from '../../modules/roles/entity/roles.entity';
import { seedAdminUser } from '../user.seeder';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('User Seeder', () => {
  let dataSource: jest.Mocked<DataSource>;
  let userRepository: jest.Mocked<Repository<User>>;
  let roleRepository: jest.Mocked<Repository<Role>>;
  let consoleSpy: jest.SpyInstance;
  let bcryptSpy: jest.SpyInstance;

  beforeEach(() => {
    userRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    roleRepository = {
      findOne: jest.fn(),
    } as any;

    dataSource = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === User) return userRepository;
        if (entity === Role) return roleRepository;
        return null;
      }),
    } as any;

    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    bcryptSpy = bcrypt.hash as jest.Mock;
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockRestore();
  });

  it('should create admin user when none exists', async () => {
    // Arrange
    userRepository.findOne.mockResolvedValue(null);
    const mockAdminRole = { id: 1, role_name: 'Administrateur' };
    roleRepository.findOne.mockResolvedValue(mockAdminRole as any);
    bcryptSpy.mockResolvedValue('hashedPassword123');

    const mockAdminUser = { id: 1, email: 'admin@example.com' };
    userRepository.create.mockReturnValue(mockAdminUser as any);
    userRepository.save.mockResolvedValue(mockAdminUser as any);

    // Act
    await seedAdminUser(dataSource);

    // Assert
    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { email: 'admin@example.com' },
    });
    expect(roleRepository.findOne).toHaveBeenCalledWith({
      where: { role_name: 'Administrateur' },
    });
    expect(bcrypt.hash).toHaveBeenCalledWith('adminpassword123', 10);

    expect(userRepository.create).toHaveBeenCalledWith({
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@example.com',
      password: 'hashedPassword123',
      is2FAEnabled: false,
      isEmailConfirmed: true,
      date_of_birth: new Date('1980-01-01'),
      user_account_balance: 0,
      email_notifications_enabled: true,
      sms_notifications_enabled: false,
      newsletter_subscribed: true,
      role: mockAdminRole,
    });

    expect(userRepository.save).toHaveBeenCalledWith(mockAdminUser);
    expect(consoleSpy).toHaveBeenCalledWith('Admin user created successfully');
  });

  it('should skip creation when admin user already exists', async () => {
    // Arrange
    const existingAdmin = { id: 1, email: 'admin@example.com' };
    userRepository.findOne.mockResolvedValue(existingAdmin as any);

    // Act
    await seedAdminUser(dataSource);

    // Assert
    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { email: 'admin@example.com' },
    });
    expect(roleRepository.findOne).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(userRepository.create).not.toHaveBeenCalled();
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Admin user already exists');
  });

  it('should throw error when admin role is not found', async () => {
    // Arrange
    userRepository.findOne.mockResolvedValue(null);
    roleRepository.findOne.mockResolvedValue(null);

    // Act & Assert
    await expect(seedAdminUser(dataSource)).rejects.toThrow(
      'Admin role not found. Please seed roles first.',
    );

    expect(userRepository.create).not.toHaveBeenCalled();
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('should use correct salt rounds for password hashing', async () => {
    // Arrange
    userRepository.findOne.mockResolvedValue(null);
    roleRepository.findOne.mockResolvedValue({
      id: 1,
      role_name: 'Administrateur',
    } as any);
    bcryptSpy.mockResolvedValue('hashedPassword');
    userRepository.create.mockReturnValue({} as any);
    userRepository.save.mockResolvedValue({} as any);

    // Act
    await seedAdminUser(dataSource);

    // Assert
    expect(bcrypt.hash).toHaveBeenCalledWith('adminpassword123', 10);
  });

  it('should create user with correct default values', async () => {
    // Arrange
    userRepository.findOne.mockResolvedValue(null);
    const mockRole = { id: 1, role_name: 'Administrateur' };
    roleRepository.findOne.mockResolvedValue(mockRole as any);
    bcryptSpy.mockResolvedValue('hashed');
    userRepository.create.mockReturnValue({} as any);
    userRepository.save.mockResolvedValue({} as any);

    // Act
    await seedAdminUser(dataSource);

    // Assert
    const createCall = userRepository.create.mock.calls[0][0];
    expect(createCall.is2FAEnabled).toBe(false);
    expect(createCall.isEmailConfirmed).toBe(true);
    expect(createCall.user_account_balance).toBe(0);
    expect(createCall.email_notifications_enabled).toBe(true);
    expect(createCall.sms_notifications_enabled).toBe(false);
    expect(createCall.newsletter_subscribed).toBe(true);
    expect(createCall.date_of_birth).toEqual(new Date('1980-01-01'));
    expect(createCall.role).toBe(mockRole);
  });

  it('should handle bcrypt hashing errors', async () => {
    // Arrange
    userRepository.findOne.mockResolvedValue(null);
    roleRepository.findOne.mockResolvedValue({
      id: 1,
      role_name: 'Administrateur',
    } as any);
    bcryptSpy.mockRejectedValue(new Error('Hashing failed'));

    // Act & Assert
    await expect(seedAdminUser(dataSource)).rejects.toThrow('Hashing failed');
  });
});
