import { readdirSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { MailerService } from '../mailer.service';
import { ESSENTIAL_EMAIL_TEMPLATES } from '../email-preferences';

// The profile's "e-mail notifications" switch: notices and reminders follow
// it, account e-mails never do.
describe('e-mail notifications setting', () => {
  let transporter: { sendMail: jest.Mock };
  let query: jest.Mock;
  let service: MailerService;

  const send = (template: string) =>
    service.sendMail('Jean@Club.fr', 'Sujet', 'Texte', template, {}, 'fr');

  beforeEach(() => {
    process.env.MAIL_HOST = 'smtp.test';
    transporter = { sendMail: jest.fn().mockResolvedValue({}) };
    query = jest
      .fn()
      .mockResolvedValue([{ email_notifications_enabled: false }]);
    const moduleRef = {
      get: (token: unknown) => (token === DataSource ? { query } : null),
    };
    service = new MailerService(transporter as any, moduleRef as any);
  });

  it.each([
    'reservation-confirmation',
    'reservation-modification',
    'reservation-cancellation',
    'instruction-booking',
    'licence-expiring',
    'licence-digest',
  ])('does not send %s to a member who turned them off', async (template) => {
    expect(await send(template)).toBe(false);
    expect(transporter.sendMail).not.toHaveBeenCalled();
    expect(query.mock.calls[0][1]).toEqual(['Jean@Club.fr']);
  });

  it.each([...ESSENTIAL_EMAIL_TEMPLATES])(
    'always sends %s',
    async (template) => {
      expect(await send(template)).toBe(true);
      expect(transporter.sendMail).toHaveBeenCalledTimes(1);
      expect(query).not.toHaveBeenCalled();
    },
  );

  it('sends notices to a member who keeps them on, or to an unknown address', async () => {
    query.mockResolvedValueOnce([{ email_notifications_enabled: true }]);
    expect(await send('reservation-confirmation')).toBe(true);
    query.mockResolvedValueOnce([]);
    expect(await send('reservation-confirmation')).toBe(true);
  });

  it('names only templates that exist', () => {
    const templates = readdirSync(join(__dirname, '..', '..', 'templates'));
    for (const name of ESSENTIAL_EMAIL_TEMPLATES) {
      expect(templates).toContain(`${name}.hbs`);
    }
  });
});
