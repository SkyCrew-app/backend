import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entity/users.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

describe('UsersService', () => {
  let service: UsersService;
  let repository: Repository<User>;

  const mockUserRepository = {
    findOne: jest.fn().mockResolvedValue({
      id: 1,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
    }),
    save: jest
      .fn()
      .mockResolvedValue({ id: 1, first_name: 'John', last_name: 'Doe' }),
    create: jest
      .fn()
      .mockReturnValue({ id: 1, first_name: 'John', last_name: 'Doe' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return a user by email', async () => {
    const result = await service.findOneByEmail('john.doe@example.com');
    expect(result).toEqual({
      id: 1,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
    });
    expect(mockUserRepository.findOne).toHaveBeenCalledWith({
      where: { email: 'john.doe@example.com' },
    });
  });

  it('should create a new user with hashed password', async () => {
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword'); // Mock de bcrypt

    const newUser = {
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane.doe@example.com',
      password: 'plaintextpassword',
    };

    const result = await service.create(newUser);

    expect(mockUserRepository.create).toHaveBeenCalledWith({
      ...newUser,
      password: 'hashedPassword',
    });
    expect(result).toEqual({ id: 1, first_name: 'John', last_name: 'Doe' });
  });

  it('should update the user password', async () => {
    const user = {
      id: 1,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      password: 'oldPassword',
    };
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('newHashedPassword');
    mockUserRepository.findOne.mockResolvedValue(user);

    await service.setPassword('john.doe@example.com', 'newPassword');

    expect(mockUserRepository.save).toHaveBeenCalledWith({
      ...user,
      password: 'newHashedPassword',
    });
  });

  it('should throw an error if user is not found when updating password', async () => {
    mockUserRepository.findOne.mockResolvedValue(null);
    await expect(
      service.setPassword('unknown@example.com', 'newPassword'),
    ).rejects.toThrow('User not found');
  });

  it('should confirm the user email', async () => {
    const user = {
      id: 1,
      email: 'john.doe@example.com',
      isEmailConfirmed: false,
    };
    mockUserRepository.findOne.mockResolvedValue(user);

    await service.confirmEmail('john.doe@example.com');

    expect(mockUserRepository.save).toHaveBeenCalledWith({
      ...user,
      isEmailConfirmed: true,
    });
  });
});
