import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { localized } from '../../common/i18n/localized-exception';
import { Language } from '../../common/i18n/languages';
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

// The category a member without a licence may book: a dual flight.
export const STUDENT_FLIGHT_CATEGORY = FlightCategory.INSTRUCTION;

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
}

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
// A member with a valid licence books any flight. A member without one (a
// student pilot) only books an instruction flight, and only on a day an
// instructor has scheduled a lesson with them: never alone.
export const assertAllowedToFly = (pilot: {
  licences: PilotLicence[] | null | undefined;
  acceptedTypes: string[] | null | undefined;
  flightCategory: FlightCategory | string | undefined;
  flightEnd: Date;
  hasLessonThatDay: boolean;
}): void => {
  if (hasValidLicence(pilot.licences, pilot.acceptedTypes, pilot.flightEnd)) {
    return;
  }
  if (pilot.flightCategory !== STUDENT_FLIGHT_CATEGORY) {
    throw localized(BadRequestException, 'error.reservation.noValidLicence');
  }
  if (!pilot.hasLessonThatDay) {
    throw localized(BadRequestException, 'error.reservation.noLessonThatDay');
  }
};

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
