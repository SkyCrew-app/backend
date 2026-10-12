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
    process.env.MAIL_HOST = 'smtp.test';
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

  describe('templates', () => {
    const shippedTemplates = [
      '2fa-enabled',
      'change-password',
      'confirmation-email',
      'reservation-cancellation',
      'reservation-confirmation',
      'reservation-modification',
      'update-user',
    ];

    it.each(shippedTemplates)(
      'finds and renders the %s template from the module directory',
      async (templateName) => {
        jest.restoreAllMocks();

        await service.sendMail(
          'user@example.com',
          'Subject',
          'Text',
          templateName,
          {
            first_name: 'Jean',
          },
        );

        const [{ html }] = (transporter.sendMail as jest.Mock).mock.calls.at(
          -1,
        );
        expect(html).toContain('<');
        expect(html.length).toBeGreaterThan(100);
      },
    );

    it('does not depend on the working directory or NODE_ENV', async () => {
      jest.restoreAllMocks();
      const cwd = jest.spyOn(process, 'cwd').mockReturnValue('/somewhere/else');
      process.env.NODE_ENV = 'production';

      await expect(
        service.sendMail('user@example.com', 'Subject', 'Text', '2fa-enabled', {
          first_name: 'Jean',
        }),
      ).resolves.toBe(true);

      cwd.mockRestore();
      process.env.NODE_ENV = 'test';
    });
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

    it('says the e-mail did not leave when its template is missing, without throwing', async () => {
      (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('File not found');
      });

      await expect(
        service.sendMail('a@b.com', 'Subj', 'Text', 'missing', {}),
      ).resolves.toBe(false);
      expect(transporter.sendMail).not.toHaveBeenCalled();
    });

    it('says the e-mail left when the mail server accepted it', async () => {
      await expect(
        service.sendMail('a@b.com', 'Subj', 'Text', 'change-password', {}),
      ).resolves.toBe(true);
    });

    it('does not throw when the mail server refuses or cannot be reached', async () => {
      (transporter.sendMail as jest.Mock).mockRejectedValueOnce(
        new Error('connect ECONNREFUSED 127.0.0.1:587'),
      );

      await expect(
        service.sendMail('a@b.com', 'Subj', 'Text', 'change-password', {}),
      ).resolves.toBe(false);
    });

    it('does not even try when no mail server is configured', async () => {
      delete process.env.MAIL_HOST;

      await expect(
        service.sendMail('a@b.com', 'Subj', 'Text', 'change-password', {}),
      ).resolves.toBe(false);
      expect(transporter.sendMail).not.toHaveBeenCalled();
    });
  });
});
