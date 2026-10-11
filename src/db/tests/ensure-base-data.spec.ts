import { ensureBaseData } from '../ensure-base-data';
import * as roles from '../roles.seeder';
import * as users from '../user.seeder';
import * as settings from '../admin.seeder';

describe('ensureBaseData', () => {
  const dataSource = {} as any;
  let order: string[];

  beforeEach(() => {
    order = [];
    jest.spyOn(roles, 'seedRoles').mockImplementation(async () => {
      order.push('roles');
    });
    jest.spyOn(users, 'seedAdminUser').mockImplementation(async () => {
      order.push('admin');
    });
    jest.spyOn(settings, 'seedAdministration').mockImplementation(async () => {
      order.push('settings');
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('creates the roles, then the first administrator, then the settings', async () => {
    await ensureBaseData(dataSource);

    expect(order).toEqual(['roles', 'admin', 'settings']);
    expect(roles.seedRoles).toHaveBeenCalledWith(dataSource);
  });

  it('lets the application start when the administrator cannot be created', async () => {
    jest
      .spyOn(users, 'seedAdminUser')
      .mockRejectedValue(new Error('ADMIN_PASSWORD must be set'));

    await expect(ensureBaseData(dataSource)).resolves.toBeUndefined();
    expect(order).toEqual(['roles']);
  });
});
