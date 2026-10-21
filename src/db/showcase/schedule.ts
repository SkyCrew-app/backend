import {
  assertAllowedToFly,
  instructorFeeCents,
  MAX_BOOKING_HOURS,
  MIN_BOOKING_MINUTES,
  priceCents,
} from '../../modules/reservations/booking-rules';
import { FlightCategory } from '../../modules/reservations/entity/reservations.entity';
import { Random } from './random';
import {
  CalendarSettings,
  clubAccepts,
  ClubDay,
  clubInstant,
  DAY,
  HOUR,
  slotMinutes,
} from './calendar';
import { FleetAircraft } from './fleet';
import {
  BASE,
  CANCELLATION_REASONS,
  COURSE_FEEDBACK,
  DESTINATIONS,
  FLIGHT_REMARKS,
  LESSONS,
  LOCAL_PURPOSES,
  STUDENT_COMMENTS,
  WEEKEND_PURPOSES,
} from './content';
import { DraftBooking, DraftCourse, DraftMember } from './model';

const MINUTE = 60_000;

export interface Window {
  start: Date;
  end: Date;
}

export interface ScheduleSettings extends CalendarSettings {
  pilotLicenses?: string[] | null;
}

// Who is busy when: the aircraft, and each member whichever seat they take.
export class Agenda {
  private readonly spans = new Map<string, [number, number][]>();

  free(key: string, start: Date, end: Date): boolean {
    return !(this.spans.get(key) ?? []).some(
      ([from, to]) => from < end.getTime() && start.getTime() < to,
    );
  }

  take(key: string, start: Date, end: Date): void {
    const list = this.spans.get(key) ?? [];
    list.push([start.getTime(), end.getTime()]);
    this.spans.set(key, list);
  }
}

const overlaps = (a: Window, start: Date, end: Date) =>
  a.start.getTime() < end.getTime() && start.getTime() < a.end.getTime();

export interface ScheduleInput {
  rng: Random;
  now: Date;
  settings: ScheduleSettings;
  days: ClubDay[];
  members: DraftMember[];
  fleet: FleetAircraft[];
  // Periods each aircraft is held by a maintenance.
  maintenance: Map<string, Window[]>;
  instruction: boolean;
  // Bookings are made once the accounts are opened (the history start).
  historyStart: Date;
}

// The opening balances are entered at 07:00 on the first day of the
// history; the first bookings are made after.
export const LEDGER_OPENS_AFTER = 8 * HOUR;

// Whether a booking may be made, by the rules the API applies when it
// books (booking-rules.ts), at the moment it was booked.
export const bookingProblem = (
  input: Pick<ScheduleInput, 'settings' | 'maintenance' | 'instruction'>,
  agenda: Agenda,
  booking: Pick<
    DraftBooking,
    'aircraft' | 'pilot' | 'instructor' | 'start' | 'end' | 'bookedAt'
  >,
): string | null => {
  const { start, end, aircraft, pilot, instructor } = booking;
  const minutes = (end.getTime() - start.getTime()) / MINUTE;
  if (minutes < MIN_BOOKING_MINUTES || minutes > MAX_BOOKING_HOURS * 60) {
    return 'duration';
  }
  if (booking.bookedAt.getTime() > start.getTime()) return 'booked after start';
  if (pilot.joined.getTime() > booking.bookedAt.getTime())
    return 'not a member yet';
  if (!clubAccepts(input.settings, start, end)) return 'club closed';
  if (!agenda.free(`aircraft:${aircraft.key}`, start, end))
    return 'aircraft taken';
  if (
    (input.maintenance.get(aircraft.key) ?? []).some((w) =>
      overlaps(w, start, end),
    )
  ) {
    return 'maintenance';
  }
  if (!agenda.free(`member:${pilot.key}`, start, end)) return 'pilot busy';
  if (instructor && !agenda.free(`member:${instructor.key}`, start, end)) {
    return 'instructor busy';
  }
  if (instructor && instructor.key === pilot.key) return 'instructor is pilot';
  if (aircraft.advanced && !pilot.experienced && !instructor) return 'aircraft';
  // The licence was active when booked: validity follows its dates.
  const asBooked = (member: DraftMember) =>
    member.licences.map((licence) => ({
      license_type: licence.license_type,
      expiration_date: licence.expiration_date,
      is_valid: true,
      status: 'active',
    }));
  try {
    assertAllowedToFly({
      pilotLicences: asBooked(pilot),
      instructorLicences: instructor ? asBooked(instructor) : null,
      withInstructor: instructor !== null,
      acceptedTypes: input.settings.pilotLicenses,
      flightEnd: end,
      instructionOffered: input.instruction,
    });
  } catch {
    return 'licence';
  }
  return null;
};

const seasonFactor = (month: number) =>
  [0.45, 0.55, 0.7, 0.85, 1, 1.1, 1.1, 0.9, 1, 0.9, 0.7, 0.5][month];

const roundTo = (value: number, step: number) =>
  Math.round(value / step) * step;

export interface ScheduleResult {
  bookings: DraftBooking[];
  courses: DraftCourse[];
}

export const planSchedule = (input: ScheduleInput): ScheduleResult => {
  const { rng, now, days, members, fleet, settings } = input;
  const agenda = new Agenda();
  const slot = slotMinutes(settings);
  const bookings: DraftBooking[] = [];
  const courses: DraftCourse[] = [];
  const instructionFleet = fleet.filter(
    (a) => !a.advanced && a.templateCode !== 'PA28-161',
  );

  const bookedAtFor = (pilot: DraftMember, start: Date): Date => {
    const earliest = Math.max(
      pilot.joined.getTime(),
      start.getTime() - 21 * DAY,
      input.historyStart.getTime() + LEDGER_OPENS_AFTER,
    );
    const latest = Math.min(
      start.getTime() - HOUR,
      now.getTime() - 10 * MINUTE,
    );
    if (latest <= earliest) return new Date(latest);
    const lead = rng.weighted([
      [1, 3],
      [3, 4],
      [7, 3],
      [14, 2],
    ] as const);
    const wanted = start.getTime() - lead * DAY + rng.int(-6, 6) * HOUR;
    return new Date(Math.min(latest, Math.max(earliest, wanted)));
  };

  const place = (
    booking: Omit<
      DraftBooking,
      | 'bookedAt'
      | 'priceCents'
      | 'flight'
      | 'cancelledAt'
      | 'cancelReason'
      | 'cancelledBy'
    >,
  ): DraftBooking | null => {
    const draft: DraftBooking = {
      ...booking,
      bookedAt: bookedAtFor(booking.pilot, booking.start),
      priceCents:
        priceCents(booking.aircraft.hourlyCost, booking.start, booking.end) +
        instructorFeeCents(
          booking.instructor !== null,
          booking.start,
          booking.end,
        ),
      flight: null,
      cancelledAt: null,
      cancelReason: null,
      cancelledBy: null,
    };
    if (bookingProblem(input, agenda, draft)) return null;
    agenda.take(`aircraft:${draft.aircraft.key}`, draft.start, draft.end);
    agenda.take(`member:${draft.pilot.key}`, draft.start, draft.end);
    if (draft.instructor) {
      agenda.take(`member:${draft.instructor.key}`, draft.start, draft.end);
    }
    bookings.push(draft);
    return draft;
  };

  // A start on the club's slots that leaves room for `minutes`.
  const slotIn = (
    day: ClubDay,
    minutes: number,
    preferMorning = false,
  ): Date | null => {
    const last = day.to - minutes;
    if (last < day.from) return null;
    const count = Math.floor((last - day.from) / slot);
    const pick = preferMorning
      ? Math.min(count, Math.floor(rng.next() * rng.next() * (count + 1)))
      : rng.int(0, count);
    return clubInstant(day.start, day.from + pick * slot);
  };

  // ---- Instruction: each student, lesson after lesson ----
  if (input.instruction) {
    for (const student of members.filter((m) => m.kind === 'student')) {
      const instructor = student.instructor!;
      let lesson = 0;
      let cursor = Math.max(
        student.joined.getTime() + 3 * DAY,
        days[0].start.getTime(),
      );
      let upcoming = 0;
      while (lesson < LESSONS.length && upcoming < 2) {
        const candidates = days.filter(
          (d) =>
            d.start.getTime() >= cursor &&
            d.start.getTime() < cursor + 6 * DAY &&
            (d.weekday === 'saturday' ||
              d.weekday === 'wednesday' ||
              rng.chance(0.25)),
        );
        let placed: DraftBooking | null = null;
        for (const day of rng.shuffle(candidates)) {
          const minutes = rng.pick([90, 120, 120]);
          for (let attempt = 0; attempt < 6 && !placed; attempt++) {
            const start = slotIn(day, minutes);
            if (!start) break;
            const end = new Date(start.getTime() + minutes * MINUTE);
            if (
              start.getTime() < now.getTime() &&
              end.getTime() > now.getTime()
            )
              continue;
            const aircraft = rng.pick(instructionFleet);
            const definition = LESSONS[lesson];
            placed = place({
              aircraft,
              pilot: student,
              instructor,
              start,
              end,
              category: FlightCategory.INSTRUCTION,
              purpose: `Leçon ${lesson + 1} — ${definition.title}`,
              notes: null,
              passengers: 0,
              destination: definition.title.includes('navigation')
                ? rng.pick(DESTINATIONS.slice(0, 3)).icao
                : null,
              course: null,
            });
          }
          if (placed) break;
        }
        cursor += rng.int(6, 11) * DAY;
        if (cursor > days[days.length - 1].start.getTime() + DAY) break;
        if (!placed) continue;

        const past = placed.end.getTime() <= now.getTime();
        const definition = LESSONS[lesson];
        const cancelled = past && rng.chance(0.08);
        const allValidated = !cancelled && rng.chance(0.8);
        const course: DraftCourse = {
          instructor,
          student,
          lesson,
          start: placed.start,
          end: placed.end,
          status: cancelled ? 'CANCELED' : past ? 'COMPLETED' : 'SCHEDULED',
          feedback: past && !cancelled ? rng.pick(COURSE_FEEDBACK) : null,
          rating: past && !cancelled && rng.chance(0.6) ? rng.int(4, 5) : null,
          competencies: definition.competencies.map(
            ([name, description], index) => {
              const validated =
                past && !cancelled && (allValidated || index === 0);
              return {
                name,
                description,
                validated,
                validatedAt: validated ? placed!.end : null,
              };
            },
          ),
          comments: [],
          booking: placed,
        };
        if (past && !cancelled) {
          course.comments.push({
            author: instructor,
            content: `${definition.title} : ${course.feedback}`,
            at: new Date(placed.end.getTime() + 20 * MINUTE),
          });
          if (rng.chance(0.25)) {
            course.comments.push({
              author: student,
              content: rng.pick(STUDENT_COMMENTS),
              at: new Date(placed.end.getTime() + rng.int(2, 30) * HOUR),
            });
          }
        }
        if (cancelled) {
          placed.cancelReason = 'Météo défavorable';
        }
        placed.course = course;
        courses.push(course);
        if (!past) upcoming++;
        if (past && !cancelled && allValidated) lesson++;
      }
    }
  }

  // ---- The presentation pilot's next trips (flight plans are made on them) ----
  const presenter = members.find((m) => m.login === 'pilot');
  if (presenter) {
    const trips: [string, number][] = [
      ['LFAT', 1],
      ['LFOT', 5],
      ['LFRG', 12],
    ];
    for (const [icao, fromOffset] of trips) {
      const destination = DESTINATIONS.find((d) => d.icao === icao)!;
      const minutes = roundTo((destination.hours + 1) * 60, slot);
      for (const day of days.filter((d) => d.offset >= fromOffset)) {
        const start = slotIn(day, minutes, true);
        if (!start) continue;
        const aircraft = rng.pick(
          fleet.filter((a) => a.key === 'dr400-180' || a.key === 'c172s'),
        );
        const placed = place({
          aircraft,
          pilot: presenter,
          instructor: null,
          start,
          end: new Date(start.getTime() + minutes * MINUTE),
          category: FlightCategory.CROSS_COUNTRY,
          purpose: `Navigation ${BASE.icao} – ${destination.icao} (${destination.name})`,
          notes: 'Escale prévue, retour dans l’après-midi',
          passengers: 1,
          destination: destination.icao,
          course: null,
        });
        if (placed) break;
      }
    }
  }

  // ---- Members' own flights ----
  const flyers = members.filter(
    (m) =>
      (m.kind === 'pilot' || m.kind === 'office' || m.kind === 'instructor') &&
      m.licences.length > 0,
  );
  const instructors = members.filter((m) => m.kind === 'instructor');
  for (const day of days) {
    const month =
      Number(
        new Date(day.start.getTime() + 12 * HOUR).toISOString().slice(5, 7),
      ) - 1;
    const weekend = day.weekday === 'saturday' || day.weekday === 'sunday';
    const base = weekend
      ? rng.int(7, 11)
      : day.weekday === 'monday'
        ? rng.int(1, 3)
        : rng.int(2, 4);
    const ahead = day.offset > 14 ? 0.5 : day.offset > 7 ? 0.75 : 1;
    const wanted = Math.round(base * seasonFactor(month) * ahead);
    let made = 0;
    for (let attempt = 0; attempt < wanted * 8 && made < wanted; attempt++) {
      const pilot = rng.weighted(flyers.map((m) => [m, m.activity] as const));
      const withInstructor =
        input.instruction && pilot.kind === 'pilot' && rng.chance(0.06);
      const category = withInstructor
        ? FlightCategory.INSTRUCTION
        : rng.weighted([
            [FlightCategory.LOCAL, 45],
            [FlightCategory.TRAINING, 10],
            [FlightCategory.CROSS_COUNTRY, weekend ? 30 : 20],
            [FlightCategory.TOURISM, weekend ? 20 : 8],
          ] as const);
      const destination =
        category === FlightCategory.CROSS_COUNTRY
          ? rng.pick(DESTINATIONS)
          : null;
      const minutes = destination
        ? roundTo((destination.hours + rng.pick([0.5, 0.75, 1])) * 60, slot)
        : category === FlightCategory.TOURISM
          ? roundTo(rng.int(90, 150), slot)
          : roundTo(rng.int(60, 120), slot);
      const start = slotIn(day, minutes, weekend);
      if (!start) continue;
      const end = new Date(start.getTime() + minutes * MINUTE);
      // Nobody is half-way through a booking made just now.
      if (
        start.getTime() < now.getTime() &&
        end.getTime() > now.getTime() &&
        rng.chance(0.5)
      )
        continue;
      const pool = fleet.filter((a) => pilot.experienced || !a.advanced);
      const aircraft = rng.pick(pool);
      const instructor = withInstructor ? rng.pick(instructors) : null;
      const placed = place({
        aircraft,
        pilot,
        instructor,
        start,
        end,
        category,
        purpose: withInstructor
          ? 'Vol d’entraînement avec instructeur'
          : destination
            ? `Navigation ${BASE.icao} – ${destination.icao} (${destination.name})`
            : category === FlightCategory.TOURISM
              ? rng.pick(WEEKEND_PURPOSES)
              : category === FlightCategory.TRAINING
                ? 'Entraînement pannes et tours de piste'
                : rng.pick(LOCAL_PURPOSES),
        notes:
          destination && rng.chance(0.3)
            ? 'Escale prévue, retour dans l’après-midi'
            : null,
        passengers:
          category === FlightCategory.TOURISM
            ? rng.int(1, Math.min(3, aircraft.seats - 1))
            : category === FlightCategory.LOCAL || destination
              ? rng.int(0, 1)
              : 0,
        destination: destination?.icao ?? null,
        course: null,
      });
      if (placed) made++;
    }
  }

  bookings.sort((a, b) => a.start.getTime() - b.start.getTime());

  // ---- What happened: cancellations, flights, closings ----
  for (const booking of bookings) {
    const started = booking.start.getTime() <= now.getTime();
    if (booking.course?.status === 'CANCELED') {
      booking.cancelledAt = new Date(
        booking.start.getTime() - rng.int(2, 20) * HOUR,
      );
      if (booking.cancelledAt.getTime() <= booking.bookedAt.getTime()) {
        booking.cancelledAt = new Date(
          booking.bookedAt.getTime() +
            (booking.start.getTime() - booking.bookedAt.getTime()) / 2,
        );
      }
      continue;
    }
    if (!booking.course && started && rng.chance(0.09)) {
      const span =
        booking.start.getTime() - 30 * MINUTE - booking.bookedAt.getTime();
      if (span > HOUR) {
        booking.cancelledAt = new Date(
          booking.bookedAt.getTime() + rng.next() * span,
        );
        booking.cancelReason = rng.pick(CANCELLATION_REASONS);
        continue;
      }
    }
    if (booking.end.getTime() > now.getTime()) continue;

    const slotMinutesBooked =
      (booking.end.getTime() - booking.start.getTime()) / MINUTE;
    const ground = rng.int(15, 30);
    const destination = DESTINATIONS.find(
      (d) => d.icao === booking.destination,
    );
    const wantedMinutes = destination
      ? destination.hours * 60 * (0.85 + rng.next() * 0.15)
      : slotMinutesBooked * (0.5 + rng.next() * 0.3);
    const flightMinutes = Math.max(
      20,
      Math.min(
        roundTo(wantedMinutes, 5),
        roundTo(slotMinutesBooked - ground - 10, 5),
      ),
    );
    const departure = new Date(booking.start.getTime() + ground * MINUTE);
    const arrival = new Date(departure.getTime() + flightMinutes * MINUTE);
    const recent = now.getTime() - arrival.getTime() < 2 * DAY;
    const closedAt =
      recent && rng.chance(0.45)
        ? null
        : new Date(
            Math.min(
              arrival.getTime() + rng.int(10, 90) * MINUTE,
              now.getTime() - MINUTE,
            ),
          );
    booking.flight = {
      booking,
      hours: Math.round((flightMinutes / 60) * 100) / 100,
      departure,
      arrival,
      origin: BASE.icao,
      destination: booking.destination ?? BASE.icao,
      closedAt,
      remarks: rng.pick(FLIGHT_REMARKS),
      passengers: booking.passengers,
    };
  }
  return { bookings, courses };
};
