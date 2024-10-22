import { Test, TestingModule } from '@nestjs/testing';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';

describe('UsersResolver', () => {
  let resolver: UsersResolver;
  let usersService: Partial<UsersService>;

  beforeEach(async () => {
    usersService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOneByEmail: jest.fn(),
      updateUser: jest.fn(),
      updatePassword: jest.fn(),
      updateNotificationSettings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersResolver,
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    resolver = module.get<UsersResolver>(UsersResolver);
  });

  it('should create a user', async () => {
    const createUserInput = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      password: 'plainpassword',
      date_of_birth: new Date('1990-01-01'),
    };

    const user = { id: 1, ...createUserInput };

    (usersService.create as jest.Mock).mockResolvedValue(user);

    const result = await resolver.createUser(
      'John',
      'Doe',
      'john.doe@example.com',
      'plainpassword',
      new Date('1990-01-01'),
    );

    expect(usersService.create).toHaveBeenCalledWith(createUserInput);
    expect(result).toEqual(user);
  });

  it('should return all users', async () => {
    const users = [{ id: 1, email: 'john.doe@example.com' }];

    (usersService.findAll as jest.Mock).mockResolvedValue(users);

    const result = await resolver.getUsers();

    expect(usersService.findAll).toHaveBeenCalled();
    expect(result).toEqual(users);
  });

  it('should update user password', async () => {
    const user = {
      id: 1,
      email: 'john.doe@example.com',
      password: 'newpassword',
    };

    (usersService.updatePassword as jest.Mock).mockResolvedValue(user);

    const result = await resolver.updatePassword('oldpassword', 'newpassword', {
      req: { user: { id: 1 } },
    });

    expect(usersService.updatePassword).toHaveBeenCalledWith(
      1,
      'oldpassword',
      'newpassword',
    );
    expect(result).toEqual(user);
  });
});
