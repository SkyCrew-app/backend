import { Test, TestingModule } from '@nestjs/testing';
import { AdministrationService } from './administration.service';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '../mail/mailer.service';
import { UsersService } from '../users/users.service';

describe('AdministrationService', () => {
  let service: AdministrationService;

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mockJwtToken'),
  };

  const mockMailerService = {
    sendMail: jest.fn().mockResolvedValue(true),
  };

  const mockUsersService = {
    findOneByEmail: jest
      .fn()
      .mockResolvedValue({ id: 1, email: 'test@example.com' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdministrationService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailerService, useValue: mockMailerService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<AdministrationService>(AdministrationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
