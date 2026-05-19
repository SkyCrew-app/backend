/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '../mailer.service';
import { Transporter } from 'nodemailer';
import * as fs from 'fs';
import * as Handlebars from 'handlebars';

describe('MailerService', () => {
  let service: MailerService;
  let transporter: Transporter;
  const MOCK_HTML = '<p>Hello, {{name}}!</p>';
  const COMPILED_HTML = '<p>Hello, John!</p>';

  beforeEach(async () => {
    transporter = {
      sendMail: jest.fn().mockResolvedValue({}),
    } as any;

    jest
      .spyOn(fs, 'readFileSync')
      .mockImplementation((path: string) => MOCK_HTML);
    jest.spyOn(Handlebars, 'compile').mockImplementation((template: string) => {
      return (vars: any) => {
        // simple replace for test
        return COMPILED_HTML;
      };
    });

    process.env.MAIL_FROM = 'no-reply@test.com';
    process.env.NODE_ENV = 'test';

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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMail', () => {
    it('should load the template, compile variables and send email', async () => {
      const to = 'user@example.com';
      const subject = 'Test Subject';
      const text = 'Plain text content';
      const templateName = 'welcome';
      const variables = { name: 'John' };

      await service.sendMail(to, subject, text, templateName, variables);

      const expectedPath = expect.stringContaining(
        `modules/templates/${templateName}.hbs`,
      );
      expect(fs.readFileSync).toHaveBeenCalledWith(expectedPath, 'utf8');
      expect(Handlebars.compile).toHaveBeenCalledWith(MOCK_HTML);
      expect(transporter.sendMail).toHaveBeenCalledWith({
        from: process.env.MAIL_FROM,
        to,
        subject,
        text,
        html: COMPILED_HTML,
      });
    });

    it('should throw if template loading fails', async () => {
      (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('File not found');
      });

      await expect(
        service.sendMail('a@b.com', 'Subj', 'Text', 'missing', {}),
      ).rejects.toThrow('File not found');
    });
  });
});
