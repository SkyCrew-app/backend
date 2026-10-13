// The actions the trace knows. A module that adopts the trace adds its own
// here, so the list offered as a filter stays complete.
export const ADMIN_ACTION = {
  BALANCE_ADJUSTED: 'balance.adjusted',
  PAYMENT_STATUS_CHANGED: 'payment.status_changed',
  PAYMENT_REFUND_RECORDED: 'payment.refund_recorded',
  MEMBER_ROLE_CHANGED: 'member.role_changed',
  MEMBER_DEACTIVATED: 'member.deactivated',
  MEMBER_REACTIVATED: 'member.reactivated',
  MEMBER_DELETED: 'member.deleted',
  INVITATION_RESENT: 'member.invitation_resent',
  SETTINGS_CHANGED: 'settings.changed',
  SITE_MAINTENANCE_TOGGLED: 'settings.maintenance_toggled',
  INCIDENT_STATUS_CHANGED: 'incident.status_changed',
  INCIDENT_DELETED: 'incident.deleted',
  ROLE_CREATED: 'role.created',
  ROLE_RENAMED: 'role.renamed',
  ROLE_DELETED: 'role.deleted',
  // An administrator acting on the booking of another member.
  RESERVATION_CHANGED_FOR_MEMBER: 'reservation.changed_for_member',
  RESERVATION_CANCELLED_FOR_MEMBER: 'reservation.cancelled_for_member',
  // A closed flight amended or deleted (see also flight_amendments, which
  // keeps the flight before and after).
  FLIGHT_RECORD_AMENDED: 'flight.record_amended',
  FLIGHT_RECORD_DELETED: 'flight.record_deleted',
  AIRCRAFT_GROUNDED: 'aircraft.grounded',
  AIRCRAFT_RETURNED_TO_SERVICE: 'aircraft.returned_to_service',
  AIRCRAFT_DELETED: 'aircraft.deleted',
  AIRCRAFT_RETIRED: 'aircraft.retired',
} as const;

export type AdminActionName = (typeof ADMIN_ACTION)[keyof typeof ADMIN_ACTION];

export const ADMIN_ACTION_NAMES: string[] = Object.values(ADMIN_ACTION);

export const ADMIN_ACTIONS_PAGE_SIZE = 25;
export const ADMIN_ACTIONS_MAX_PAGE_SIZE = 100;

// Nothing that opens an account or a payment is ever written to the trace,
// whatever a caller passes.
const SECRET_KEY = /pass(word)?|token|secret|hash|client_secret|iban|card/i;
const MAX_TEXT_LENGTH = 300;
// Deep enough for { changes: { field: { from, to } } } when the value of a
// setting is itself a list or a small object.
const MAX_DEPTH = 5;

const sanitizeValue = (value: unknown, depth: number): unknown => {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value.length > MAX_TEXT_LENGTH
      ? `${value.slice(0, MAX_TEXT_LENGTH)}…`
      : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (depth >= MAX_DEPTH) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) {
        continue;
      }
      clean[key] = sanitizeValue(item, depth + 1);
    }
    return clean;
  }
  return null;
};

export const sanitizeSummary = (
  summary: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null => {
  if (!summary) {
    return null;
  }
  const clean = sanitizeValue(summary, 0) as Record<string, unknown>;
  return Object.keys(clean).length > 0 ? clean : null;
};

// A value as it is compared: an empty text is no value, a date is its ISO
// text and the keys of an object are sorted (the database gives a stored
// object back with its keys in another order than the form sent them).
const canonical = (value: unknown): unknown => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])])
        .filter(([, item]) => item !== null),
    );
  }
  return value;
};

// The fields of `after` whose value differs from `before`, as
// { field: { from, to } }: what a "settings changed" line shows.
export const changedFields = (
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): Record<string, { from: unknown; to: unknown }> => {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const comparable = (value: unknown): string =>
    JSON.stringify(canonical(value));
  for (const [key, value] of Object.entries(after ?? {})) {
    if (value === undefined) {
      continue;
    }
    const previous = before?.[key];
    if (comparable(previous) !== comparable(value)) {
      changes[key] = { from: previous ?? null, to: value };
    }
  }
  return changes;
};
