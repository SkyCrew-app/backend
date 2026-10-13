import { readdirSync, readFileSync } from 'fs';
import * as fs from 'fs';
import { join } from 'path';
import { MailerService } from '../mailer.service';

const templatesDirectory = join(__dirname, '..', '..', 'templates');

const frenchTemplates = readdirSync(templatesDirectory)
  .filter((file) => file.endsWith('.hbs'))
  .map((file) => file.replace(/\.hbs$/, ''));

const variablesOf = (source: string) =>
  [...new Set(source.match(/{{{?\s*[\w.]+\s*}?}}/g) ?? [])].sort();

describe('MailerService languages', () => {
  let service: MailerService;
  let transporter: { sendMail: jest.Mock };

  const lastHtml = () => transporter.sendMail.mock.calls.at(-1)[0].html;

  beforeEach(() => {
    process.env.MAIL_HOST = 'smtp.test';
    transporter = { sendMail: jest.fn().mockResolvedValue({}) };
    service = new MailerService(transporter as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('finds the e-mails of the application', () => {
    expect(frenchTemplates.length).toBeGreaterThanOrEqual(8);
  });

  it.each(frenchTemplates)(
    '%s exists in English with the same variables',
    (name) => {
      const french = readFileSync(
        join(templatesDirectory, `${name}.hbs`),
        'utf8',
      );
      const english = readFileSync(
        join(templatesDirectory, 'en', `${name}.hbs`),
        'utf8',
      );

      expect(variablesOf(english)).toEqual(variablesOf(french));
      expect(english).not.toBe(french);
      expect(english).toContain('All rights reserved');
      expect(english).not.toContain('Tous droits réservés');
    },
  );

  it('has no English template without a French one', () => {
    const englishTemplates = readdirSync(join(templatesDirectory, 'en')).map(
      (file) => file.replace(/\.hbs$/, ''),
    );

    expect(englishTemplates.sort()).toEqual([...frenchTemplates].sort());
  });

  it('sends the French template unless another language is asked for', async () => {
    await service.sendMail('a@b.com', 'Subject', 'Text', 'reset-password', {
      first_name: 'Jean',
      resetUrl: 'https://club.example/reset?token=abc',
      validityMinutes: 60,
    });

    expect(lastHtml()).toContain('Bonjour Jean');
    expect(lastHtml()).toContain('Choisir un nouveau mot de passe');
  });

  it('sends the English template to an English-speaking member', async () => {
    await expect(
      service.sendMail(
        'a@b.com',
        'Subject',
        'Text',
        'reset-password',
        {
          first_name: 'Jean',
          resetUrl: 'https://club.example/reset?token=abc&x=1',
          validityMinutes: 60,
        },
        'en',
      ),
    ).resolves.toBe(true);

    expect(lastHtml()).toContain('Hello Jean');
    expect(lastHtml()).toContain('Choose a new password');
    expect(lastHtml()).toContain('valid for 60 minutes');
    // The link is not escaped, as in the French template.
    expect(lastHtml()).toContain('https://club.example/reset?token=abc&x=1');
    expect(lastHtml()).not.toContain('Bonjour');
  });

  it('sends the French template when the English one is missing', async () => {
    const realExistsSync = fs.existsSync;
    jest
      .spyOn(fs, 'existsSync')
      .mockImplementation((path) =>
        String(path).includes(`${join('templates', 'en')}`)
          ? false
          : realExistsSync(path),
      );

    await expect(
      service.sendMail(
        'a@b.com',
        'Subject',
        'Text',
        'change-password',
        { name: 'Jean' },
        'en',
      ),
    ).resolves.toBe(true);

    expect(lastHtml()).toContain('Bonjour, Jean');
  });
});
