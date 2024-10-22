import { Test, TestingModule } from '@nestjs/testing';
import { AdministrationResolver } from './administration.resolver';
import { AdministrationService } from './administration.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AdministrationResolver', () => {
  let resolver: AdministrationResolver;
  let administrationService: Partial<AdministrationService>;
  let usersService: Partial<UsersService>;
  let jwtService: Partial<JwtService>;

  beforeEach(async () => {
    administrationService = {
      createUserByAdmin: jest.fn(),
    };

    usersService = {
      setPassword: jest.fn(),
      confirmEmail: jest.fn(),
    };

    jwtService = {
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdministrationResolver,
        { provide: AdministrationService, useValue: administrationService },
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    resolver = module.get<AdministrationResolver>(AdministrationResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should create a user', async () => {
    const createUserInput = {
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
      password: null,
      is2FAEnabled: false,
      twoFactorAuthSecret: null,
    };

    (administrationService.createUserByAdmin as jest.Mock).mockResolvedValue(
      createUserInput,
    );

    const result = await resolver.createUserByAdmin(createUserInput);

    expect(result).toEqual(createUserInput);
    expect(administrationService.createUserByAdmin).toHaveBeenCalledWith(
      createUserInput,
    );
  });

  it('should confirm email and set password', async () => {
    const token = 'valid-token';
    const password = 'newPassword123';
    const email = 'test@example.com';

    (jwtService.verify as jest.Mock).mockReturnValue({ email });
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

    const result = await resolver.confirmEmailAndSetPassword(token, password);

    expect(jwtService.verify).toHaveBeenCalledWith(token, {
      secret: process.env.JWT_SECRET,
    });
    expect(usersService.setPassword).toHaveBeenCalledWith(
      email,
      'hashedPassword',
    );
    expect(usersService.confirmEmail).toHaveBeenCalledWith(email);
    expect(result).toBe(true);
  });
});
