import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { localized } from '../../common/i18n/localized-exception';
import { Language } from '../../common/i18n/languages';
import {
  hasRole,
  ROLE_INSTRUCTOR,
  SessionUser,
} from '../../common/auth/access';
import { FlightCategory } from './entity/reservations.entity';

// Every business choice about bookings lives in this file.

// Opening hours, closure days and the dates written in e-mails are those of
// the club, whatever the time zone of the server.
export const CLUB_TIME_ZONE = 'Europe/Paris';

export const MIN_BOOKING_MINUTES = 15;
export const MAX_BOOKING_HOURS = 24;

// A member cancels or changes a booking until this many minutes before it
// starts. Afterwards a cancellation is an administrator's decision.
export const MEMBER_CANCELLATION_DEADLINE_MINUTES = 0;
// A booking is no longer the member's to cancel once a flight was flown on
// it: a closed flight, or any flight still attached after the start time.
export const FLOWN_BOOKING_CANCELLABLE_BY_MEMBER = false;
// A closed flight is in the logbook: its booking stays, even for an
// administrator, who corrects the account by hand instead.
export const CLOSED_FLIGHT_BOOKING_CANCELLABLE_BY_ADMIN = false;

// A flight with an instructor on board is an instruction flight: the
// booking takes this category whatever was sent.
export const INSTRUCTION_FLIGHT_CATEGORY = FlightCategory.INSTRUCTION;

// OWNER DECISION PENDING — what the instructor costs the student, in euros
// per booked hour, on top of the aircraft. Zero: the student pays the
// aircraft only. Every price of a booking goes through instructorFeeCents.
export const INSTRUCTOR_FEE_PER_HOUR = 0;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

interface ClubMoment {
  // Calendar day at the club, "2026-10-13".
  day: string;
  // English weekday, lower case.
  weekday: string;
  minutesOfDay: number;
}

const clubPartsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLUB_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export const clubMoment = (date: Date): ClubMoment => {
  const parts: Record<string, string> = {};
  for (const { type, value } of clubPartsFormat.formatToParts(date)) {
    parts[type] = value;
  }
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday.toLowerCase(),
    minutesOfDay: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

// Club wall-clock time of an instant, read as if it were UTC: the
// difference with the instant is the club's offset from UTC at that time.
const clubOffsetMs = (instant: number): number => {
  const parts: Record<string, string> = {};
  for (const { type, value } of clubPartsFormat.formatToParts(
    new Date(instant),
  )) {
    parts[type] = value;
  }
  const seconds = new Date(instant).getUTCSeconds();
  const wall = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    seconds,
  );
  return wall - (instant - new Date(instant).getUTCMilliseconds());
};

// The instant a calendar day at the club begins (midnight, club time).
const clubMidnight = (year: number, month: number, day: number): Date => {
  const wall = Date.UTC(year, month, day);
  let instant = wall - clubOffsetMs(wall);
  // Once more, in case the offset changed in between (summer time).
  instant = wall - clubOffsetMs(instant);
  return new Date(instant);
};

// Midnight at the club, `days` days after the club day of `date`.
export const clubDayStart = (date: Date, days = 0): Date => {
  const [year, month, day] = clubMoment(date).day.split('-').map(Number);
  return clubMidnight(year, month - 1, day + days);
};

// The first day of a month at the club, `months` months after the club
// month of `date`, at midnight.
export const clubMonthStart = (date: Date, months = 0): Date => {
  const [year, month] = clubMoment(date).day.split('-').map(Number);
  return clubMidnight(year, month - 1 + months, 1);
};

// A date as written in an e-mail: club time, in the member's language.
export const mailDate = (date: Date | string, language: Language): string => {
  const parts: Record<string, string> = {};
  const format = new Intl.DateTimeFormat(
    language === 'en' ? 'en-GB' : 'fr-FR',
    {
      timeZone: CLUB_TIME_ZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    },
  );
  for (const { type, value } of format.formatToParts(new Date(date))) {
    parts[type] = value;
  }
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
};

// End after start, a duration within bounds, and not in the past.
export const assertValidSlot = (start: Date, end: Date, now: Date): void => {
  const startMs = start?.getTime?.();
  const endMs = end?.getTime?.();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw localized(BadRequestException, 'error.reservation.endBeforeStart');
  }
  if (endMs <= startMs) {
    throw localized(BadRequestException, 'error.reservation.endBeforeStart');
  }
  if (endMs - startMs < MIN_BOOKING_MINUTES * MINUTE) {
    throw localized(BadRequestException, 'error.reservation.tooShort', {
      minutes: MIN_BOOKING_MINUTES,
    });
  }
  if (endMs - startMs > MAX_BOOKING_HOURS * HOUR) {
    throw localized(BadRequestException, 'error.reservation.tooLong', {
      hours: MAX_BOOKING_HOURS,
    });
  }
  if (startMs < now.getTime()) {
    throw localized(BadRequestException, 'error.reservation.inThePast');
  }
};

const WEEKDAYS: Record<string, string> = {
  lundi: 'monday',
  mardi: 'tuesday',
  mercredi: 'wednesday',
  jeudi: 'thursday',
  vendredi: 'friday',
  samedi: 'saturday',
  dimanche: 'sunday',
};

// Closure days are stored as day names, in French or in English.
const weekdayOf = (name: string): string => {
  const plain = String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
  return WEEKDAYS[plain] ?? plain;
};

// "08:00" or "08:00:00" as minutes since midnight, or null.
const minutesOf = (time: unknown): number | null => {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(time ?? ''));
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes <= 24 * 60 ? minutes : null;
};

export interface ClubOpening {
  closureDays?: string[] | null;
  reservationStartTime?: string | null;
  reservationEndTime?: string | null;
  // The weekly maintenance of the club's settings: a day name and a length
  // in hours.
  maintenanceDay?: string | null;
  maintenanceDuration?: number | null;
}

// OWNER DECISION PENDING — the settings give the day and the length of the
// weekly maintenance, not its start: it is taken to begin when bookings open
// that day (reservationStartTime, midnight when none is set). Returns the
// window in minutes of that day, or null when there is none.
export const weeklyMaintenanceWindow = (
  settings: ClubOpening,
): { weekday: string; from: number; to: number } | null => {
  const hours = Number(settings.maintenanceDuration);
  if (!settings.maintenanceDay || !Number.isFinite(hours) || hours <= 0) {
    return null;
  }
  const from = minutesOf(settings.reservationStartTime) ?? 0;
  return {
    weekday: weekdayOf(settings.maintenanceDay),
    from,
    to: Math.min(from + Math.round(hours * 60), 24 * 60),
  };
};

const clock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// A new or moved booking stays out of the weekly maintenance. Bookings made
// before the setting was changed are left as they are.
const assertOutsideWeeklyMaintenance = (
  settings: ClubOpening,
  from: ClubMoment,
  to: ClubMoment,
): void => {
  const window = weeklyMaintenanceWindow(settings);
  if (!window) return;
  // The minutes the booking takes on each club day it touches (a booking
  // lasts 24 hours at most: one or two days).
  const spans =
    from.day === to.day
      ? [
          {
            weekday: from.weekday,
            start: from.minutesOfDay,
            end: to.minutesOfDay + 1,
          },
        ]
      : [
          { weekday: from.weekday, start: from.minutesOfDay, end: 24 * 60 },
          { weekday: to.weekday, start: 0, end: to.minutesOfDay + 1 },
        ];
  const clash = spans.some(
    (span) =>
      span.weekday === window.weekday &&
      span.start < window.to &&
      window.from < span.end,
  );
  if (clash) {
    throw localized(
      BadRequestException,
      'error.reservation.weeklyMaintenance',
      {
        from: clock(window.from),
        to: clock(window.to),
      },
    );
  }
};

// The closure days and opening hours of the club, where its settings define
// them. A booking then holds within the opening hours of a single day.
export const assertClubOpen = (
  settings: ClubOpening,
  start: Date,
  end: Date,
): void => {
  const from = clubMoment(start);
  // The last minute booked: a booking ending at closing time is inside.
  const to = clubMoment(new Date(end.getTime() - 1));

  const closed = (settings.closureDays ?? []).map(weekdayOf);
  if (closed.includes(from.weekday) || closed.includes(to.weekday)) {
    throw localized(BadRequestException, 'error.reservation.clubClosedDay');
  }
  assertOutsideWeeklyMaintenance(settings, from, to);

  const opening = minutesOf(settings.reservationStartTime);
  const closing = minutesOf(settings.reservationEndTime);
  if (opening === null || closing === null || closing <= opening) {
    return;
  }
  if (
    from.day !== to.day ||
    from.minutesOfDay < opening ||
    to.minutesOfDay >= closing
  ) {
    throw localized(
      BadRequestException,
      'error.reservation.outsideOpeningHours',
      {
        opening: String(settings.reservationStartTime).slice(0, 5),
        closing: String(settings.reservationEndTime).slice(0, 5),
      },
    );
  }
};

export interface PilotLicence {
  license_type: string;
  expiration_date?: Date | string | null;
  is_valid?: boolean;
  status?: string;
}

// A licence the club accepts, valid until the end of the flight. An empty
// club list accepts every type of licence.
export const hasValidLicence = (
  licences: PilotLicence[] | null | undefined,
  acceptedTypes: string[] | null | undefined,
  flightEnd: Date,
): boolean =>
  (licences ?? []).some((licence) => {
    if (licence.is_valid === false) return false;
    if (licence.status && licence.status !== 'active') return false;
    if (
      licence.expiration_date &&
      new Date(licence.expiration_date).getTime() < flightEnd.getTime()
    ) {
      return false;
    }
    return (
      !acceptedTypes?.length || acceptedTypes.includes(licence.license_type)
    );
  });

// OWNER DECISION — who may fly.
// Alone, the pilot needs a valid licence. With an instructor on board, the
// licence that must be valid is the instructor's: a member without a licence
// (a student pilot) therefore flies with an instructor, never alone, and
// cannot book at all where the plan does not include instruction.
export const assertAllowedToFly = (crew: {
  pilotLicences: PilotLicence[] | null | undefined;
  // Null or undefined when nobody instructs.
  instructorLicences?: PilotLicence[] | null;
  withInstructor: boolean;
  acceptedTypes: string[] | null | undefined;
  flightEnd: Date;
  // False when the plan of the club does not include instruction: a pilot
  // without a licence then cannot book at all.
  instructionOffered?: boolean;
}): void => {
  if (crew.withInstructor) {
    if (
      !hasValidLicence(
        crew.instructorLicences,
        crew.acceptedTypes,
        crew.flightEnd,
      )
    ) {
      throw localized(
        BadRequestException,
        'error.reservation.instructorNoValidLicence',
      );
    }
    return;
  }
  if (
    !hasValidLicence(crew.pilotLicences, crew.acceptedTypes, crew.flightEnd)
  ) {
    throw localized(
      BadRequestException,
      crew.instructionOffered === false
        ? 'error.reservation.licenceRequired'
        : 'error.reservation.instructorRequired',
    );
  }
};

// Who may instruct: an active member holding the instructor role, other
// than the pilot.
export const assertCanInstruct = (
  instructor: Pick<SessionUser, 'id' | 'role'> & { is_active?: boolean | null },
  pilotId: number,
): void => {
  if (Number(instructor.id) === Number(pilotId)) {
    throw localized(BadRequestException, 'error.reservation.instructorIsPilot');
  }
  if (
    !hasRole(instructor as SessionUser, ROLE_INSTRUCTOR) ||
    instructor.is_active === false
  ) {
    throw localized(BadRequestException, 'error.reservation.notAnInstructor');
  }
};

// What the instructor adds to the price of a slot, in cents.
export const instructorFeeCents = (
  withInstructor: boolean,
  start: Date,
  end: Date,
): number =>
  withInstructor
    ? Math.round(
        ((end.getTime() - start.getTime()) / HOUR) *
          INSTRUCTOR_FEE_PER_HOUR *
          100,
      )
    : 0;

// Price of a slot in cents, rounded once.
export const priceCents = (hourlyCost: number, start: Date, end: Date) => {
  const cents = Math.round(
    ((end.getTime() - start.getTime()) / HOUR) * Number(hourlyCost) * 100,
  );
  if (!Number.isFinite(cents) || cents < 0) {
    throw localized(BadRequestException, 'error.reservation.invalidPrice');
  }
  return cents;
};

export interface BookingActor {
  isAdmin: boolean;
  // The member acting, when known: an instructor who cancels a booking they
  // instruct declines it, under the same rules as its holder.
  userId?: number;
}

interface BookedSlot {
  start_time: Date | string;
  flights?: { closed_at?: Date | string | null }[] | null;
}

const hasStarted = (booking: BookedSlot, now: Date, marginMinutes = 0) =>
  now.getTime() >
  new Date(booking.start_time).getTime() - marginMinutes * MINUTE;

// A booking is changed before it starts, by anyone.
export const assertChangeable = (booking: BookedSlot, now: Date): void => {
  if (hasStarted(booking, now, MEMBER_CANCELLATION_DEADLINE_MINUTES)) {
    throw localized(ForbiddenException, 'error.reservation.alreadyStarted');
  }
};

export const assertCancellable = (
  booking: BookedSlot,
  actor: BookingActor,
  now: Date,
): void => {
  const flights = booking.flights ?? [];
  const closed = flights.some((flight) => flight.closed_at);

  if (actor.isAdmin) {
    if (closed && !CLOSED_FLIGHT_BOOKING_CANCELLABLE_BY_ADMIN) {
      throw localized(ConflictException, 'error.reservation.flightClosed');
    }
    return;
  }

  if (closed && !FLOWN_BOOKING_CANCELLABLE_BY_MEMBER) {
    throw localized(ConflictException, 'error.reservation.flightClosed');
  }
  if (hasStarted(booking, now, MEMBER_CANCELLATION_DEADLINE_MINUTES)) {
    throw localized(
      ForbiddenException,
      flights.length > 0 && !FLOWN_BOOKING_CANCELLABLE_BY_MEMBER
        ? 'error.reservation.flightFlown'
        : 'error.reservation.cancelAfterStart',
    );
  }
};
