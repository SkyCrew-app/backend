import { Role } from '../entity/roles.entity';
import { User } from '../../users/entity/users.entity';

describe('Role Entity', () => {
  it('should create a role instance', () => {
    const role = new Role();
    expect(role).toBeInstanceOf(Role);
  });

  it('should set all properties correctly', () => {
    const role = new Role();
    const user1 = new User();
    const user2 = new User();

    user1.id = 1;
    user2.id = 2;

    role.id = 1;
    role.role_name = 'Administrator';
    role.users = [user1, user2];

    expect(role.id).toBe(1);
    expect(role.role_name).toBe('Administrator');
    expect(role.users).toEqual([user1, user2]);
    expect(role.users).toHaveLength(2);
  });

  it('should allow users array to be empty', () => {
    const role = new Role();
    role.id = 1;
    role.role_name = 'Empty Role';
    role.users = [];

    expect(role.users).toEqual([]);
    expect(role.users).toHaveLength(0);
  });

  it('should allow users array to be null or undefined', () => {
    const role = new Role();
    role.id = 1;
    role.role_name = 'No Users Role';
    role.users = null;

    expect(role.users).toBeNull();
  });

  it('should handle different role names', () => {
    const roleNames = [
      'Administrator',
      'User',
      'Moderator',
      'Super Admin',
      'Guest',
      'Manager',
    ];

    roleNames.forEach((roleName) => {
      const role = new Role();
      role.role_name = roleName;
      expect(role.role_name).toBe(roleName);
    });
  });
});
