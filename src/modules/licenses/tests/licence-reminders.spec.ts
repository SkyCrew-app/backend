import { readdirSync } from 'fs';
import { join } from 'path';
import { LicenceRemindersService } from '../licence-reminders.service';

const NOW = new Date('2026-10-13T08:00:00Z');
const inDays = (days: number) => new Date(NOW.getTime() + days * 86400_000);

describe('LicenceRemindersService', () => {
  let service: LicenceRemindersService;
  let licences: {
    findExpiringLicenses: jest.Mock;
    claimExpiryReminder: jest.Mock;
  };
  let notifications: { create: jest.Mock; alreadySent: jest.Mock };
  let mailer: { sendMail: jest.Mock };
  let users: { findActiveAdministrators: jest.Mock };

  const licence = (changes: Record<string, unknown> = {}) => ({
    id: 4,
    license_type: 'PPL',
    license_number: 'PPL-FR-001',
    status: 'active',
    expiration_date: inDays(30),
    expiry_reminder_days: null,
    expiry_reminder_for: null,
    user: {
      id: 9,
      email: 'jean@club.fr',
      first_name: 'Jean',
      last_name: 'Dupont',
      language: 'fr',
      is_active: true,
    },
    ...changes,
  });

  beforeEach(() => {
    licences = {
      findExpiringLicenses: jest.fn().mockResolvedValue([]),
      claimExpiryReminder: jest.fn().mockResolvedValue(true),
    };
    notifications = {
      create: jest.fn(),
      alreadySent: jest.fn().mockResolvedValue(false),
    };
    mailer = { sendMail: jest.fn().mockResolvedValue(true) };
    users = { findActiveAdministrators: jest.fn().mockResolvedValue([]) };
    service = new LicenceRemindersService(
      licences as any,
      notifications as any,
      mailer as any,
      users as any,
    );
  });

  describe('expiry reminders', () => {
    it('looks 60 days ahead', async () => {
      await service.sendExpiryReminders(NOW);

      expect(licences.findExpiringLicenses).toHaveBeenCalledWith(60, NOW);
    });

    it('reminds by e-mail and in the application, in French for a French-speaking member', async () => {
      const due = licence();
      licences.findExpiringLicenses.mockResolvedValue([due]);

      await expect(service.sendExpiryReminders(NOW)).resolves.toBe(1);

      expect(licences.claimExpiryReminder).toHaveBeenCalledWith(due, 30);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 9,
          notification_type: 'LICENSE_EXPIRING_SOON',
          message:
            'Votre licence PPL expire dans 30 jour(s), le 12/11/2026. Pensez à la renouveler.',
        }),
      );
      expect(mailer.sendMail).toHaveBeenCalledWith(
        'jean@club.fr',
        'Votre licence PPL arrive à expiration',
        expect.stringContaining('expire dans 30 jour(s)'),
        'licence-expiring',
        {
          name: 'Jean',
          licenceType: 'PPL',
          licenceNumber: 'PPL-FR-001',
          days: 30,
          date: '12/11/2026',
        },
        'fr',
      );
    });

    it('writes to an English-speaking member in English', async () => {
      const due = licence({ expiration_date: inDays(7) });
      due.user.language = 'en';
      licences.findExpiringLicenses.mockResolvedValue([due]);

      await service.sendExpiryReminders(NOW);

      expect(notifications.create.mock.calls[0][0].message).toBe(
        'Your PPL licence expires in 7 day(s), on 20/10/2026. Remember to renew it.',
      );
      expect(mailer.sendMail.mock.calls[0][1]).toBe(
        'Your PPL licence is about to expire',
      );
      expect(mailer.sendMail.mock.calls[0][5]).toBe('en');
    });

    it('sends each step once: nothing the next night, the next step when it comes', async () => {
      // Night 1: 60 days left.
      const due = licence({ expiration_date: inDays(60) });
      licences.findExpiringLicenses.mockResolvedValue([due]);
      await service.sendExpiryReminders(NOW);
      expect(licences.claimExpiryReminder).toHaveBeenLastCalledWith(due, 60);
      expect(mailer.sendMail).toHaveBeenCalledTimes(1);

      // Night 2: the step is recorded on the licence, for this expiry date.
      const nextNight = licence({
        expiration_date: inDays(60),
        expiry_reminder_days: 60,
        expiry_reminder_for: inDays(60),
      });
      licences.findExpiringLicenses.mockResolvedValue([nextNight]);
      await service.sendExpiryReminders(new Date(NOW.getTime() + 86400_000));
      expect(mailer.sendMail).toHaveBeenCalledTimes(1);
      expect(notifications.create).toHaveBeenCalledTimes(1);

      // A month later: the 30-day step.
      await service.sendExpiryReminders(inDays(30));
      expect(licences.claimExpiryReminder).toHaveBeenLastCalledWith(
        nextNight,
        30,
      );
      expect(mailer.sendMail).toHaveBeenCalledTimes(2);
    });

    it('does not depend on the notification still being there', async () => {
      // The member emptied their notifications: the step stays recorded on
      // the licence, and alreadySent is not what decides.
      const reminded = licence({
        expiry_reminder_days: 30,
        expiry_reminder_for: inDays(30),
      });
      licences.findExpiringLicenses.mockResolvedValue([reminded]);

      await service.sendExpiryReminders(NOW);

      expect(notifications.alreadySent).not.toHaveBeenCalled();
      expect(mailer.sendMail).not.toHaveBeenCalled();
    });

    it('starts again for a renewed licence', async () => {
      const renewed = licence({
        expiration_date: inDays(45),
        expiry_reminder_days: 7,
        expiry_reminder_for: inDays(-320),
      });
      licences.findExpiringLicenses.mockResolvedValue([renewed]);

      await service.sendExpiryReminders(NOW);

      expect(licences.claimExpiryReminder).toHaveBeenCalledWith(renewed, 60);
      expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    });

    it('sends nothing when another instance of the job claimed the step first', async () => {
      licences.findExpiringLicenses.mockResolvedValue([licence()]);
      licences.claimExpiryReminder.mockResolvedValue(false);

      await expect(service.sendExpiryReminders(NOW)).resolves.toBe(0);
      expect(mailer.sendMail).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('leaves alone deactivated members, pending licences and licences already past', async () => {
      const deactivated = licence();
      deactivated.user.is_active = false;
      licences.findExpiringLicenses.mockResolvedValue([
        deactivated,
        licence({ status: 'pending' }),
        licence({ expiration_date: inDays(-3) }),
      ]);

      await service.sendExpiryReminders(NOW);

      expect(licences.claimExpiryReminder).not.toHaveBeenCalled();
      expect(mailer.sendMail).not.toHaveBeenCalled();
    });

    it('goes on with the other licences when one fails', async () => {
      licences.findExpiringLicenses.mockResolvedValue([
        licence({ id: 1 }),
        licence({ id: 2 }),
      ]);
      licences.claimExpiryReminder
        .mockRejectedValueOnce(new Error('down'))
        .mockResolvedValueOnce(true);

      await expect(service.sendExpiryReminders(NOW)).resolves.toBe(1);
    });
  });

  describe('monthly digest for administrators', () => {
    const admin = (language: string, id = 1) => ({
      id,
      email: `admin${id}@club.fr`,
      first_name: 'Anne',
      language,
    });

    it('lists the licences expiring within 60 days, to each administrator in their language', async () => {
      licences.findExpiringLicenses.mockResolvedValue([
        licence({ expiration_date: inDays(12) }),
        licence({ id: 5, expiration_date: inDays(-4) }),
      ]);
      users.findActiveAdministrators.mockResolvedValue([
        admin('fr', 1),
        admin('en', 2),
      ]);

      await expect(service.sendAdminDigest(NOW)).resolves.toBe(2);

      expect(licences.findExpiringLicenses).toHaveBeenCalledWith(60, NOW);
      // The licence already past its date is not "expiring".
      const [to, subject, text, template, variables, language] =
        mailer.sendMail.mock.calls[0];
      expect([to, subject, template, language]).toEqual([
        'admin1@club.fr',
        'Licences arrivant à expiration : 1',
        'licence-digest',
        'fr',
      ]);
      expect(text).toBe(
        '1 licence(s) de membres expirent dans les 60 prochains jours (récapitulatif 2026-10).',
      );
      expect(variables.licences).toEqual([
        {
          member: 'Jean Dupont',
          licenceType: 'PPL',
          licenceNumber: 'PPL-FR-001',
          date: '25/10/2026',
          days: 12,
        },
      ]);
      expect(mailer.sendMail.mock.calls[1][1]).toBe(
        'Licences about to expire: 1',
      );
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 2,
          notification_type: 'LICENCE_DIGEST',
          message:
            '1 member licence(s) expire within the next 60 days (2026-10 digest).',
        }),
      );
    });

    it('sends a month once, even when the job runs twice', async () => {
      licences.findExpiringLicenses.mockResolvedValue([licence()]);
      users.findActiveAdministrators.mockResolvedValue([admin('fr')]);
      notifications.alreadySent.mockResolvedValue(true);

      await expect(service.sendAdminDigest(NOW)).resolves.toBe(0);
      expect(mailer.sendMail).not.toHaveBeenCalled();
      // Recognised whatever the language it was written in.
      expect(notifications.alreadySent.mock.calls[0][2]).toHaveLength(2);
    });

    it('sends nothing when no licence is about to expire', async () => {
      users.findActiveAdministrators.mockResolvedValue([admin('fr')]);

      await expect(service.sendAdminDigest(NOW)).resolves.toBe(0);
      expect(users.findActiveAdministrators).not.toHaveBeenCalled();
    });
  });

  it('has its two e-mail templates in French and in English', () => {
    const templates = join(__dirname, '..', '..', 'templates');
    for (const directory of [templates, join(templates, 'en')]) {
      expect(readdirSync(directory)).toEqual(
        expect.arrayContaining(['licence-expiring.hbs', 'licence-digest.hbs']),
      );
    }
  });
});
