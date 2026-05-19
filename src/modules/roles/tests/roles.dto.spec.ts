import { CreateRoleInput } from '../dto/create-role.input';

describe('CreateRoleInput', () => {
  it('should create instance with role_name', () => {
    const dto = new CreateRoleInput();
    dto.role_name = 'Administrator';

    expect(dto.role_name).toBe('Administrator');
  });

  it('should accept various role names', () => {
    const roleNames = ['Admin', 'User', 'Moderator', 'Super Admin'];

    roleNames.forEach((roleName) => {
      const dto = new CreateRoleInput();
      dto.role_name = roleName;
      expect(dto.role_name).toBe(roleName);
    });
  });
});

import { UpdateRoleInput } from '../dto/update-role.input';

describe('UpdateRoleInput', () => {
  it('should have required id field', () => {
    const dto = new UpdateRoleInput();
    dto.id = 1;

    expect(dto.id).toBe(1);
  });

  it('should allow optional role_name field', () => {
    const dto = new UpdateRoleInput();
    dto.id = 1;
    dto.role_name = 'Updated Role';

    expect(dto.id).toBe(1);
    expect(dto.role_name).toBe('Updated Role');
  });

  it('should allow role_name to be undefined', () => {
    const dto = new UpdateRoleInput();
    dto.id = 1;
    // role_name not set

    expect(dto.id).toBe(1);
    expect(dto.role_name).toBeUndefined();
  });
});
