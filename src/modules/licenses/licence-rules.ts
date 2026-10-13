import { BadRequestException } from '@nestjs/common';
import { localized } from '../../common/i18n/localized-exception';

// Every business choice about licences lives in this file.

// A reminder is sent when a licence has this many days left, once each.
export const LICENCE_REMINDER_DAYS = [60, 30, 7];
// Administrators receive, once a month, the licences expiring within this
// many days.
export const ADMIN_DIGEST_HORIZON_DAYS = 60;

export const LICENCE_STATUSES = ['active', 'expired', 'pending'] as const;
export type LicenceStatus = (typeof LICENCE_STATUSES)[number];

const DAY = 24 * 60 * 60 * 1000;

interface LicenceState {
  status: LicenceStatus;
  is_valid: boolean;
}

// The one place where `status` and `is_valid` are decided, so they never
// contradict each other nor the expiry date:
// - past its expiry date, a licence is expired and not valid, whatever is asked;
// - "expired" with an expiry date still to come means it was renewed: active;
// - otherwise the status is the one asked for, and only "active" is valid.
// `is_valid` alone (older clients) is read as active / pending.
export const settleLicenceState = (
  licence: {
    expiration_date?: Date | string | null;
    status?: string | null;
    is_valid?: boolean | null;
  },
  requested: { status?: string | null; is_valid?: boolean | null } = {},
  now: Date = new Date(),
): LicenceState => {
  const wanted = requested.status ?? licence.status ?? 'active';
  if (!(LICENCE_STATUSES as readonly string[]).includes(wanted)) {
    throw localized(BadRequestException, 'error.licence.unknownStatus');
  }

  const expiry = licence.expiration_date
    ? new Date(licence.expiration_date).getTime()
    : null;
  if (expiry !== null && expiry < now.getTime()) {
    return { status: 'expired', is_valid: false };
  }

  let status = wanted as LicenceStatus;
  if (status === 'expired' && expiry !== null) {
    status = 'active';
  }
  if (requested.status == null && requested.is_valid != null) {
    if (requested.is_valid === false && status === 'active') {
      status = 'pending';
    } else if (requested.is_valid === true && status === 'pending') {
      status = 'active';
    }
  }
  return { status, is_valid: status === 'active' };
};

// Whole days left before the expiry date (0 on the day itself, negative
// once passed).
export const daysUntil = (
  date: Date | string,
  now: Date = new Date(),
): number => Math.ceil((new Date(date).getTime() - now.getTime()) / DAY);

// The reminder to send now, as its number of days, or null. A licence
// entered late gets the reminder of the step it is in, not every step it
// missed; `alreadySent` is the tightest step already sent for this expiry
// date.
export const dueReminder = (
  daysLeft: number,
  alreadySent: number | null | undefined,
): number | null => {
  if (daysLeft < 0) {
    return null;
  }
  const reached = LICENCE_REMINDER_DAYS.filter((step) => daysLeft <= step);
  if (reached.length === 0) {
    return null;
  }
  const step = Math.min(...reached);
  return alreadySent != null && alreadySent <= step ? null : step;
};

// Two licences of the same type cannot carry the same number, whatever the
// case or the spaces around it.
export const normaliseLicenceNumber = (
  value: string | null | undefined,
): string => (value ?? '').trim().toUpperCase();
