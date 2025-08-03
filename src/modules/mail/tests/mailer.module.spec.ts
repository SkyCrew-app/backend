import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { mailConfig } from '../../../config/mail.config';
import { MailerModule } from '../mailer.module';

jest.mock('nodemailer');
jest.mock('../../../config/mail.config', () => ({
  mailConfig: jest.fn(),
}));

describe('MailerModule', () => {
  let moduleRef: TestingModule;
  const fakeTransport = {} as nodemailer.Transporter;

  beforeEach(async () => {
    // Set environment variables used by mailConfig
    process.env.MAIL_HOST = 'smtp.example.com';
    process.env.MAIL_PORT = '587';
    process.env.MAIL_USER = 'user';
    process.env.MAIL_PASS = 'pass';
    process.env.NODE_ENV = 'test';

    // Mock mailConfig to return a config based on ConfigService
    (mailConfig as jest.Mock).mockImplementation((cs: ConfigService) => ({
      host: cs.get('MAIL_HOST'),
      port: parseInt(cs.get('MAIL_PORT'), 10),
      auth: {
        user: cs.get('MAIL_USER'),
        pass: cs.get('MAIL_PASS'),
      },
    }));

    // Mock nodemailer transport creation
    (nodemailer.createTransport as jest.Mock).mockReturnValue(fakeTransport);

    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), MailerModule],
    }).compile();
  });

  it('should register MAIL_TRANSPORT provider using nodemailer', () => {
    // mailConfig must be called with the ConfigService instance
    const configService = moduleRef.get<ConfigService>(ConfigService);
    expect(mailConfig).toHaveBeenCalledWith(configService);

    // nodemailer.createTransport should be called with the mocked config
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      auth: {
        user: 'user',
        pass: 'pass',
      },
    });

    // The provider token should return our fakeTransport
    const transport = moduleRef.get<nodemailer.Transporter>('MAIL_TRANSPORT');
    expect(transport).toBe(fakeTransport);
  });
});
