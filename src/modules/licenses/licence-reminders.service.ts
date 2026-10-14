import { Injectable, Logger } from '@nestjs/common';
import {
  LICENCE_REMINDER_HIGH_PRIORITY_DAYS,
  NOTIFICATION_PRIORITY_HIGH,
} from '../notifications/notification-priority';
import { License } from './entity/licenses.entity';
import { LicensesService } from './licenses.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../mail/mailer.service';
import { UsersService } from '../users/users.service';
import { formatDate, languageOf } from '../../common/i18n/languages';
import {
  translate,
  translateInEveryLanguage,
} from '../../common/i18n/translate';
import {
  ADMIN_DIGEST_HORIZON_DAYS,
  daysUntil,
  dueReminder,
  LICENCE_REMINDER_DAYS,
} from './licence-rules';

const isDeactivated = (user?: { is_active?: boolean | null } | null): boolean =>
  user?.is_active === false;

const fullName = (user?: { first_name?: string; last_name?: string }) =>
  [user?.first_name, user?.last_name].filter(Boolean).join(' ');

// The step already sent for the expiry date the licence has today.
const sentStep = (licence: License): number | null => {
  if (!licence.expiration_date || !licence.expiry_reminder_for) {
    return null;
  }
  const sameExpiry =
    new Date(licence.expiry_reminder_for).getTime() ===
    new Date(licence.expiration_date).getTime();
  return sameExpiry ? (licence.expiry_reminder_days ?? null) : null;
};

// Tells members that a licence is about to expire, and administrators
// which ones are.
@Injectable()
export class LicenceRemindersService {
  private readonly logger = new Logger(LicenceRemindersService.name);

  constructor(
    private readonly licensesService: LicensesService,
    private readonly notificationsService: NotificationsService,
    private readonly mailerService: MailerService,
    private readonly usersService: UsersService,
  ) {}

  // One reminder per step (see LICENCE_REMINDER_DAYS) and per expiry date,
  // by e-mail and in the application, in the member's language. Returns the
  // number of reminders sent.
  async sendExpiryReminders(now: Date = new Date()): Promise<number> {
    const horizon = Math.max(...LICENCE_REMINDER_DAYS);
    const licences = await this.licensesService.findExpiringLicenses(
      horizon,
      now,
    );

    let sent = 0;
    for (const licence of licences) {
      // One licence that fails must not stop the others.
      try {
        if (await this.remind(licence, now)) {
          sent += 1;
        }
      } catch (error) {
        this.logger.error(
          `Expiry reminder of licence ${licence.id} failed: ${(error as Error)?.message}`,
        );
      }
    }
    return sent;
  }

  private async remind(licence: License, now: Date): Promise<boolean> {
    const member = licence.user;
    if (!member?.id || isDeactivated(member) || !licence.expiration_date) {
      return false;
    }
    // Reminders are for licences in use: a pending one is not flown with.
    if (licence.status !== 'active') {
      return false;
    }

    const daysLeft = daysUntil(licence.expiration_date, now);
    const step = dueReminder(daysLeft, sentStep(licence));
    if (step === null) {
      return false;
    }
    // Claimed in the database first: of two jobs running at once, one sends.
    if (!(await this.licensesService.claimExpiryReminder(licence, step))) {
      return false;
    }

    const language = languageOf(member);
    const params = {
      licenceType: licence.license_type,
      days: daysLeft,
      date: formatDate(language, licence.expiration_date),
    };
    const message = translate(
      language,
      'notification.licenceExpiresIn',
      params,
    );

    await this.notificationsService.create({
      user_id: member.id,
      notification_type: 'LICENSE_EXPIRING_SOON',
      message,
      notification_date: now,
      expiration_date: licence.expiration_date,
      is_read: false,
      ...(daysLeft <= LICENCE_REMINDER_HIGH_PRIORITY_DAYS && {
        priority: NOTIFICATION_PRIORITY_HIGH,
      }),
    });
    await this.mailerService.sendMail(
      member.email,
      translate(language, 'mail.licenceExpiring.subject', {
        licenceType: licence.license_type,
      }),
      message,
      'licence-expiring',
      {
        name: member.first_name,
        licenceType: licence.license_type,
        licenceNumber: licence.license_number,
        days: daysLeft,
        date: params.date,
      },
      language,
    );
    return true;
  }

  // The monthly list for administrators: licences of active members that
  // expire within ADMIN_DIGEST_HORIZON_DAYS, soonest first. Nothing is sent
  // when there is none, and an administrator receives a given month once.
  async sendAdminDigest(now: Date = new Date()): Promise<number> {
    const licences = (
      await this.licensesService.findExpiringLicenses(
        ADMIN_DIGEST_HORIZON_DAYS,
        now,
      )
    ).filter(
      (licence) =>
        licence.expiration_date &&
        licence.user?.id &&
        !isDeactivated(licence.user) &&
        daysUntil(licence.expiration_date, now) >= 0,
    );
    if (licences.length === 0) {
      return 0;
    }

    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const administrators = await this.usersService.findActiveAdministrators();

    let sent = 0;
    for (const administrator of administrators) {
      try {
        const language = languageOf(administrator);
        const params = {
          count: licences.length,
          days: ADMIN_DIGEST_HORIZON_DAYS,
          month,
        };
        const alreadySent = await this.notificationsService.alreadySent(
          administrator.id,
          'LICENCE_DIGEST',
          translateInEveryLanguage('notification.licenceDigest', params),
        );
        if (alreadySent) {
          continue;
        }

        const message = translate(
          language,
          'notification.licenceDigest',
          params,
        );
        await this.notificationsService.create({
          user_id: administrator.id,
          notification_type: 'LICENCE_DIGEST',
          message,
          notification_date: now,
          is_read: false,
        });
        await this.mailerService.sendMail(
          administrator.email,
          translate(language, 'mail.licenceDigest.subject', {
            count: licences.length,
          }),
          message,
          'licence-digest',
          {
            name: administrator.first_name,
            count: licences.length,
            horizonDays: ADMIN_DIGEST_HORIZON_DAYS,
            licences: licences.map((licence) => ({
              member: fullName(licence.user),
              licenceType: licence.license_type,
              licenceNumber: licence.license_number,
              date: formatDate(language, licence.expiration_date),
              days: daysUntil(licence.expiration_date, now),
            })),
          },
          language,
        );
        sent += 1;
      } catch (error) {
        this.logger.error(
          `Licence digest for administrator ${administrator.id} failed: ${(error as Error)?.message}`,
        );
      }
    }
    return sent;
  }
}
