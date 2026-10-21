import {
  assertClubOpen,
  ClubOpening,
  clubDayStart,
  clubMoment,
} from '../../modules/reservations/booking-rules';
import { sunTimes } from '../../modules/navplan/engine/solar';

const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// "08:00" or "08:00:00" as minutes since midnight, or null.
export const minutesOfClock = (time: unknown): number | null => {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(time ?? ''));
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes <= 24 * 60 ? minutes : null;
};

// The instant a club day reaches `minutes` on the club's clock, summer time
// changes included.
export const clubInstant = (dayStart: Date, minutes: number): Date => {
  let instant = new Date(dayStart.getTime() + minutes * MINUTE);
  for (let i = 0; i < 2; i++) {
    // Daytime minutes only: the day cannot change on the way.
    const shift = minutes - clubMoment(instant).minutesOfDay;
    if (shift === 0) break;
    instant = new Date(instant.getTime() + shift * MINUTE);
  }
  return instant;
};

export interface ClubDay {
  start: Date;
  // English weekday at the club, lower case.
  weekday: string;
  // Offset from today, in days (0 = today, negative = past).
  offset: number;
  // Bookable minutes of the day: opening hours and daylight (VFR day),
  // aligned on the club's slot.
  from: number;
  to: number;
}

export interface CalendarSettings extends ClubOpening {
  timeSlotDuration?: number | null;
}

export const slotMinutes = (settings: CalendarSettings): number => {
  const slot = Number(settings.timeSlotDuration);
  return Number.isFinite(slot) && slot >= 15 && slot <= 120 ? slot : 30;
};

// The club days between `fromOffset` and `toOffset` (days from today), with
// the window a booking may take: inside the opening hours of the settings
// (08:00-20:00 when none are set), between sunrise and sunset at the base,
// on the club's slots. Closed days are left out; the weekly maintenance is
// left to assertClubOpen, which every booking goes through.
export const clubDays = (
  settings: CalendarSettings,
  now: Date,
  fromOffset: number,
  toOffset: number,
  base: { lat: number; lon: number },
): ClubDay[] => {
  const slot = slotMinutes(settings);
  let opening = minutesOfClock(settings.reservationStartTime);
  let closing = minutesOfClock(settings.reservationEndTime);
  if (opening === null || closing === null || closing <= opening) {
    opening = 8 * 60;
    closing = 20 * 60;
  }
  const days: ClubDay[] = [];
  for (let offset = fromOffset; offset <= toOffset; offset++) {
    const start = clubDayStart(now, offset);
    const noon = clubInstant(start, 12 * 60);
    const sun = sunTimes(base.lat, base.lon, noon);
    const minutesAt = (date: Date | null, fallback: number) =>
      date ? clubMoment(date).minutesOfDay : fallback;
    const sunrise = minutesAt(sun.sunrise, 7 * 60);
    const sunset = minutesAt(sun.sunset, 19 * 60);
    const from = Math.ceil(Math.max(opening, sunrise + 15) / slot) * slot;
    const to = Math.floor(Math.min(closing, sunset - 10) / slot) * slot;
    if (to - from < 60) continue;
    // A one-hour probe at noon tells whether the day is a closure day.
    try {
      assertClubOpen(
        { closureDays: settings.closureDays },
        noon,
        new Date(noon.getTime() + HOUR),
      );
    } catch {
      continue;
    }
    days.push({
      start,
      weekday: clubMoment(noon).weekday,
      offset,
      from,
      to,
    });
  }
  return days;
};

// Whether the club accepts a booking over this slot (closure days, weekly
// maintenance, opening hours): the API's own rule.
export const clubAccepts = (
  settings: ClubOpening,
  start: Date,
  end: Date,
): boolean => {
  try {
    assertClubOpen(settings, start, end);
    return true;
  } catch {
    return false;
  }
};
