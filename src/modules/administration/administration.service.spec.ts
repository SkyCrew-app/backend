import { Test, TestingModule } from '@nestjs/testing';
import { AdministrationService } from './administration.service';
import { UsersService } from '../users/users.service';
import { MailerService } from '../mail/mailer.service';
import { JwtService } from '@nestjs/jwt';

describe('AdministrationService', () => {
  let service: AdministrationService;
  let usersService: Partial<UsersService>;
  let mailerService: Partial<MailerService>;
  let jwtService: Partial<JwtService>;

  beforeEach(async () => {
    usersService = {
      create: jest.fn(),
      setPassword: jest.fn(),
      confirmEmail: jest.fn(),
    };

    mailerService = {
      sendMail: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('test-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdministrationService,
        { provide: UsersService, useValue: usersService },
        { provide: MailerService, useValue: mailerService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AdministrationService>(AdministrationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a user and send a confirmation email', async () => {
    const createUserInput = {
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
      password: null,
      is2FAEnabled: false,
      twoFactorAuthSecret: null,
    };

    const createdUser = {
      ...createUserInput,
      password: null,
    };

    (usersService.create as jest.Mock).mockResolvedValue(createdUser);

    await service.createUserByAdmin(createUserInput);

    expect(usersService.create).toHaveBeenCalledWith({
      ...createUserInput,
      password: null,
    });
    expect(jwtService.sign).toHaveBeenCalledWith(
      { email: createdUser.email },
      { secret: process.env.JWT_SECRET, expiresIn: '1d' },
    );
    expect(mailerService.sendMail).toHaveBeenCalled();
  });
});
