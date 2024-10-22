import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entity/users.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { MailerService } from '../mail/mailer.service';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: Partial<Repository<User>>;
  let mailerService: Partial<MailerService>;

  beforeEach(async () => {
    usersRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    mailerService = {
      sendMail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: usersRepository },
        { provide: MailerService, useValue: mailerService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should create a user and hash the password', async () => {
    const createUserInput = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      password: 'plainpassword',
      date_of_birth: new Date('1990-01-01'),
    };

    const hashedPassword = 'hashedpassword';

    (bcrypt.hash as jest.Mock) = jest.fn().mockResolvedValue(hashedPassword);
    (usersRepository.create as jest.Mock).mockReturnValue(createUserInput);
    (usersRepository.save as jest.Mock).mockResolvedValue(createUserInput);

    const result = await service.create(createUserInput);

    expect(bcrypt.hash).toHaveBeenCalledWith('plainpassword', 10);
    expect(usersRepository.create).toHaveBeenCalledWith({
      ...createUserInput,
      password: hashedPassword,
    });
    expect(usersRepository.save).toHaveBeenCalledWith(createUserInput);
    expect(result).toEqual(createUserInput);
  });

  it('should update user notification settings', async () => {
    const user = {
      id: 1,
      email_notifications_enabled: false,
      sms_notifications_enabled: false,
      newsletter_subscribed: false,
    } as User;

    (usersRepository.findOne as jest.Mock).mockResolvedValue(user);
    (usersRepository.save as jest.Mock).mockResolvedValue({
      ...user,
      email_notifications_enabled: true,
      sms_notifications_enabled: true,
      newsletter_subscribed: true,
    });

    const result = await service.updateNotificationSettings(
      1,
      true,
      true,
      true,
    );

    expect(usersRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(usersRepository.save).toHaveBeenCalledWith({
      ...user,
      email_notifications_enabled: true,
      sms_notifications_enabled: true,
      newsletter_subscribed: true,
    });
    expect(result).toEqual({
      ...user,
      email_notifications_enabled: true,
      sms_notifications_enabled: true,
      newsletter_subscribed: true,
    });
  });

  it('should update password', async () => {
    const user = {
      id: 1,
      password: 'oldhashedpassword',
      email: 'john.doe@example.com',
      first_name: 'John',
    } as User;

    (usersRepository.findOne as jest.Mock).mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('newhashedpassword');

    (usersRepository.save as jest.Mock).mockResolvedValue({
      ...user,
      password: 'newhashedpassword',
    });

    const result = await service.updatePassword(
      1,
      'oldpassword',
      'newpassword',
    );

    expect(bcrypt.compare).toHaveBeenCalledWith(
      'oldpassword',
      'oldhashedpassword',
    );
    expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 10);
    expect(usersRepository.save).toHaveBeenCalledWith({
      ...user,
      password: 'newhashedpassword',
    });
    expect(mailerService.sendMail).toHaveBeenCalledWith(
      'john.doe@example.com',
      'Votre mot de passe a été modifié',
      'Votre mot de passe a été modifié avec succès',
      'change-password',
      { first_name: 'John' },
    );
    expect(result).toEqual({
      ...user,
      password: 'newhashedpassword',
    });
  });
});
