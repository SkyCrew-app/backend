// The notifications a member must not miss: the "Prioritaires" tab of the
// notifications screen lists those whose priority is NOTIFICATION_PRIORITY_HIGH.
export const NOTIFICATION_PRIORITY_HIGH = 'high';

// Always high, whoever sends them.
export const HIGH_PRIORITY_NOTIFICATION_TYPES: readonly string[] = [
  // An aircraft grounded (incident, failed audit) with a booking of theirs.
  'AIRCRAFT_GROUNDED',
  'LICENSE_EXPIRED',
  // A card or PayPal payment refused or failed.
  'PAYMENT_FAILED',
];

// A licence reminder this many days or fewer before expiry is high.
export const LICENCE_REMINDER_HIGH_PRIORITY_DAYS = 7;

// A booking cancelled by someone else than the member told (an
// administrator, the instructor declining, the pilot for their instructor),
// and a licence reminder LICENCE_REMINDER_HIGH_PRIORITY_DAYS or fewer before
// expiry, are high too: their senders give NOTIFICATION_PRIORITY_HIGH.
export const priorityOf = (
  notificationType: string,
  given?: string | null,
): string | null =>
  given ??
  (HIGH_PRIORITY_NOTIFICATION_TYPES.includes(notificationType)
    ? NOTIFICATION_PRIORITY_HIGH
    : null);
