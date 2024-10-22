import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from '../src/utils/jwt.strategy';
import { UsersService } from '../src/modules/users/users.service';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy', () => {
  let jwtStrategy: JwtStrategy;
  let usersService: Partial<UsersService>;

  beforeEach(async () => {
    usersService = {
      findOneByEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should validate and return the user if valid', async () => {
    const payload = { email: 'test@example.com' };
    const user = { id: 1, email: 'test@example.com' };

    (usersService.findOneByEmail as jest.Mock).mockResolvedValue(user);

    const result = await jwtStrategy.validate(payload);
    expect(usersService.findOneByEmail).toHaveBeenCalledWith(payload.email);
    expect(result).toEqual(user);
  });

  it('should throw UnauthorizedException if user not found', async () => {
    const payload = { email: 'notfound@example.com' };

    (usersService.findOneByEmail as jest.Mock).mockResolvedValue(null);

    await expect(jwtStrategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(usersService.findOneByEmail).toHaveBeenCalledWith(payload.email);
  });
});
