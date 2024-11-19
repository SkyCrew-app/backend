import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from './mailer.service';
import { Transporter } from 'nodemailer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';

jest.mock('fs');
jest.mock('nodemailer');
jest.mock('handlebars');

describe('MailerService', () => {
  let service: MailerService;
  let transporter: Partial<Transporter>;

  beforeEach(async () => {
    transporter = {
      sendMail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailerService,
        {
          provide: 'MAIL_TRANSPORT',
          useValue: transporter,
        },
      ],
    }).compile();

    service = module.get<MailerService>(MailerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send an email with compiled template', async () => {
    const templateContent = '<p>Hello {{name}}</p>';
    const compiledHtml = '<p>Hello John</p>';

    (fs.readFileSync as jest.Mock).mockReturnValue(templateContent);
    (Handlebars.compile as jest.Mock).mockReturnValue(() => compiledHtml);

    const variables = { name: 'John' };

    await service.sendMail(
      'john.doe@example.com',
      'Welcome!',
      'This is the text content',
      'welcome-template',
      variables,
    );

    expect(fs.readFileSync).toHaveBeenCalledWith(
      expect.stringContaining('welcome-template.hbs'),
      'utf8',
    );
    expect(Handlebars.compile).toHaveBeenCalledWith(templateContent);

    expect(transporter.sendMail).toHaveBeenCalledWith({
      from: process.env.MAIL_FROM,
      to: 'john.doe@example.com',
      subject: 'Welcome!',
      text: 'This is the text content',
      html: compiledHtml,
    });
  });
});
