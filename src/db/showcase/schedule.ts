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
  // A refresh: what happens to a booking (a cancellation, a flight closed)
  // happens after the previous refresh.
  settledAfter?: Date;
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
  if (
    pilot.bookableFrom &&
    booking.bookedAt.getTime() < pilot.bookableFrom.getTime()
  )
    return 'booked before the last refresh';
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
  // The licence was active when booked: validity follows its dates, those
  // it had then when it was renewed since.
  const asBooked = (member: DraftMember) =>
    member.licences.map((licence) => ({
      license_type: licence.license_type,
      expiration_date:
        licence.renewedAt &&
        licence.previousExpiry &&
        booking.bookedAt.getTime() < licence.renewedAt.getTime()
          ? licence.previousExpiry
          : licence.expiration_date,
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

// Members book the far days less than the near ones: the share of a day's
// bookings already made, by how many days ahead it is.
export const bookedShare = (offset: number): number => {
  if (offset > 14) return 0.5;
  return offset > 7 ? 0.75 : 1;
};

// How many flights members make on a day (their own, not the lessons), all
// bookings made: busier at weekends and in summer.
export const dayDemand = (rng: Random, day: ClubDay): number => {
  const month =
    Number(
      new Date(day.start.getTime() + 12 * HOUR).toISOString().slice(5, 7),
    ) - 1;
  let base: number;
  if (day.weekday === 'saturday' || day.weekday === 'sunday') {
    base = rng.int(7, 11);
  } else if (day.weekday === 'monday') {
    base = rng.int(1, 3);
  } else {
    base = rng.int(2, 4);
  }
  return base * seasonFactor(month);
};

export interface ScheduleResult {
  bookings: DraftBooking[];
  courses: DraftCourse[];
}

// Where a student is in the syllabus and when their next lesson is looked
// for.
export interface LessonProgress {
  lesson: number;
  cursor: number;
  upcoming: number;
}

// The presentation pilot's trips: destination and the first day (from now).
export const PRESENTER_TRIPS: [string, number][] = [
  ['LFAT', 1],
  ['LFOT', 5],
  ['LFRG', 12],
];

// Places bookings by the rules of the API and decides what happened to
// them. `rng` may be swapped between decisions (a refresh draws each one
// from its own generator).
export class Scheduler {
  readonly bookings: DraftBooking[] = [];
  readonly courses: DraftCourse[] = [];
  private readonly slot: number;

  constructor(
    private readonly input: ScheduleInput,
    public rng: Random = input.rng,
    readonly agenda: Agenda = new Agenda(),
  ) {
    this.slot = slotMinutes(input.settings);
  }

  get instructionFleet(): FleetAircraft[] {
    return this.input.fleet.filter(
      (a) => !a.advanced && a.templateCode !== 'PA28-161',
    );
  }

  bookedAtFor(pilot: DraftMember, start: Date): Date {
    const { rng, input } = this;
    const earliest = Math.max(
      pilot.joined.getTime(),
      pilot.bookableFrom?.getTime() ?? 0,
      start.getTime() - 21 * DAY,
      input.historyStart.getTime() + LEDGER_OPENS_AFTER,
    );
    const latest = Math.min(
      start.getTime() - HOUR,
      input.now.getTime() - 10 * MINUTE,
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
  }

  // Books the slot when the API would, and takes it in the agenda.
  place(
    booking: Omit<
      DraftBooking,
      | 'bookedAt'
      | 'priceCents'
      | 'flight'
      | 'cancelledAt'
      | 'cancelReason'
      | 'cancelledBy'
    >,
  ): DraftBooking | null {
    const draft: DraftBooking = {
      ...booking,
      bookedAt: this.bookedAtFor(booking.pilot, booking.start),
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
    if (bookingProblem(this.input, this.agenda, draft)) return null;
    this.agenda.take(`aircraft:${draft.aircraft.key}`, draft.start, draft.end);
    this.agenda.take(`member:${draft.pilot.key}`, draft.start, draft.end);
    if (draft.instructor) {
      this.agenda.take(
        `member:${draft.instructor.key}`,
        draft.start,
        draft.end,
      );
    }
    this.bookings.push(draft);
    return draft;
  }

  // A start on the club's slots that leaves room for `minutes`.
  slotIn(day: ClubDay, minutes: number, preferMorning = false): Date | null {
    const { rng, slot } = this;
    const last = day.to - minutes;
    if (last < day.from) return null;
    const count = Math.floor((last - day.from) / slot);
    const pick = preferMorning
      ? Math.min(count, Math.floor(rng.next() * rng.next() * (count + 1)))
      : rng.int(0, count);
    return clubInstant(day.start, day.from + pick * slot);
  }

  // What happened at a course once its time has come: now and then
  // cancelled for the weather, most often every competency validated. Not
  // yet come: scheduled. Returns whether the student moves to the next
  // lesson.
  settleCourse(course: DraftCourse, cancellable = true): boolean {
    const { rng } = this;
    const placed = course.booking!;
    const past = placed.end.getTime() <= this.input.now.getTime();
    const definition = LESSONS[course.lesson];
    const cancelled = past && cancellable && rng.chance(0.08);
    const allValidated = !cancelled && rng.chance(0.8);
    course.status = 'SCHEDULED';
    if (past) course.status = cancelled ? 'CANCELED' : 'COMPLETED';
    course.feedback = past && !cancelled ? rng.pick(COURSE_FEEDBACK) : null;
    course.rating =
      past && !cancelled && rng.chance(0.6) ? rng.int(4, 5) : null;
    course.competencies = definition.competencies.map(
      ([name, description], index) => {
        const validated = past && !cancelled && (allValidated || index === 0);
        return {
          name,
          description,
          validated,
          validatedAt: validated ? placed.end : null,
        };
      },
    );
    course.comments = [];
    if (past && !cancelled) {
      course.comments.push({
        author: course.instructor,
        content: `${definition.title} : ${course.feedback}`,
        at: new Date(placed.end.getTime() + 20 * MINUTE),
      });
      if (rng.chance(0.25)) {
        course.comments.push({
          author: course.student,
          content: rng.pick(STUDENT_COMMENTS),
          at: new Date(placed.end.getTime() + rng.int(2, 30) * HOUR),
        });
      }
    }
    if (cancelled) {
      placed.cancelReason = 'Météo défavorable';
    }
    return past && !cancelled && allValidated;
  }

  // Each student, lesson after lesson, roughly weekly, with at most two
  // lessons ahead. `progress` moves on as lessons are placed. `onWindow`
  // is told of each window looked at (a refresh draws each from its own
  // generator).
  planLessons(
    student: DraftMember,
    progress: LessonProgress,
    days: ClubDay[],
    onPlaced: (course: DraftCourse) => void = () => undefined,
  ): void {
    const { input } = this;
    const instructor = student.instructor!;
    const lastDay = days[days.length - 1].start.getTime() + DAY;
    while (progress.lesson < LESSONS.length && progress.upcoming < 2) {
      const cursor = progress.cursor;
      const candidates = days.filter(
        (d) =>
          d.start.getTime() >= cursor &&
          d.start.getTime() < cursor + 6 * DAY &&
          (d.weekday === 'saturday' ||
            d.weekday === 'wednesday' ||
            this.rng.chance(0.25)),
      );
      let placed: DraftBooking | null = null;
      for (const day of this.rng.shuffle(candidates)) {
        const minutes = this.rng.pick([90, 120, 120]);
        for (let attempt = 0; attempt < 6 && !placed; attempt++) {
          const start = this.slotIn(day, minutes);
          if (!start) break;
          const end = new Date(start.getTime() + minutes * MINUTE);
          if (
            start.getTime() < input.now.getTime() &&
            end.getTime() > input.now.getTime()
          )
            continue;
          const aircraft = this.rng.pick(this.instructionFleet);
          const definition = LESSONS[progress.lesson];
          placed = this.place({
            aircraft,
            pilot: student,
            instructor,
            start,
            end,
            category: FlightCategory.INSTRUCTION,
            purpose: lessonPurpose(progress.lesson),
            notes: null,
            passengers: 0,
            destination: definition.title.includes('navigation')
              ? this.rng.pick(DESTINATIONS.slice(0, 3)).icao
              : null,
            course: null,
          });
        }
        if (placed) break;
      }
      progress.cursor += this.rng.int(6, 11) * DAY;
      if (progress.cursor > lastDay) break;
      if (!placed) continue;

      const course: DraftCourse = {
        instructor,
        student,
        lesson: progress.lesson,
        start: placed.start,
        end: placed.end,
        status: 'SCHEDULED',
        feedback: null,
        rating: null,
        competencies: [],
        comments: [],
        booking: placed,
      };
      const past = placed.end.getTime() <= input.now.getTime();
      const advanced = this.settleCourse(course);
      placed.course = course;
      this.courses.push(course);
      onPlaced(course);
      if (!past) progress.upcoming++;
      if (advanced) progress.lesson++;
    }
  }

  // The presentation pilot's next trip to `icao`, from `fromOffset` days
  // ahead (flight plans are made on it).
  planTrip(
    presenter: DraftMember,
    icao: string,
    fromOffset: number,
    days: ClubDay[],
  ): DraftBooking | null {
    const destination = DESTINATIONS.find((d) => d.icao === icao)!;
    const minutes = roundTo((destination.hours + 1) * 60, this.slot);
    const pool = this.input.fleet.filter(
      (a) => a.key === 'dr400-180' || a.key === 'c172s',
    );
    if (pool.length === 0) return null;
    for (const day of days.filter((d) => d.offset >= fromOffset)) {
      const start = this.slotIn(day, minutes, true);
      if (!start) continue;
      const aircraft = this.rng.pick(pool);
      const placed = this.place({
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
      if (placed) return placed;
    }
    return null;
  }

  // Up to `wanted` members' own flights on the day.
  fillDay(day: ClubDay, wanted: number): number {
    const { input } = this;
    const rng = this.rng;
    const flyers = input.members.filter(
      (m) =>
        (m.kind === 'pilot' ||
          m.kind === 'office' ||
          m.kind === 'instructor') &&
        m.licences.length > 0 &&
        m.activity > 0,
    );
    const instructors = input.members.filter((m) => m.kind === 'instructor');
    if (flyers.length === 0) return 0;
    const weekend = day.weekday === 'saturday' || day.weekday === 'sunday';
    let made = 0;
    for (let attempt = 0; attempt < wanted * 8 && made < wanted; attempt++) {
      const pilot = rng.weighted(flyers.map((m) => [m, m.activity] as const));
      const withInstructor =
        input.instruction &&
        pilot.kind === 'pilot' &&
        instructors.length > 0 &&
        rng.chance(0.06);
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
      const minutes = flightSlotMinutes(rng, this.slot, category, destination);
      const start = this.slotIn(day, minutes, weekend);
      if (!start) continue;
      const end = new Date(start.getTime() + minutes * MINUTE);
      // Nobody is half-way through a booking made just now.
      if (
        start.getTime() < input.now.getTime() &&
        end.getTime() > input.now.getTime() &&
        rng.chance(0.5)
      )
        continue;
      const pool = input.fleet.filter((a) => pilot.experienced || !a.advanced);
      if (pool.length === 0) continue;
      const aircraft = rng.pick(pool);
      const instructor = withInstructor ? rng.pick(instructors) : null;
      const placed = this.place({
        aircraft,
        pilot,
        instructor,
        start,
        end,
        category,
        purpose: flightPurpose(rng, category, withInstructor, destination),
        notes:
          destination && rng.chance(0.3)
            ? 'Escale prévue, retour dans l’après-midi'
            : null,
        passengers: passengersFor(rng, category, !!destination, aircraft),
        destination: destination?.icao ?? null,
        course: null,
      });
      if (placed) made++;
    }
    return made;
  }

  // What happened to a booking once its time has come: cancelled now and
  // then, otherwise flown once over (and closed by its pilot, the most
  // recent ones not always yet). A flight plan made ahead is the flight
  // flown.
  settle(booking: DraftBooking): void {
    const { rng, input } = this;
    const now = input.now.getTime();
    const after = input.settledAfter?.getTime() ?? 0;
    const started = booking.start.getTime() <= now;
    if (booking.course?.status === 'CANCELED') {
      booking.cancelledAt = new Date(
        booking.start.getTime() - rng.int(2, 20) * HOUR,
      );
      const from = Math.max(booking.bookedAt.getTime(), after);
      if (booking.cancelledAt.getTime() <= from) {
        booking.cancelledAt = new Date(
          from + (booking.start.getTime() - from) / 2,
        );
      }
      return;
    }
    if (!booking.course && !booking.flight && started && rng.chance(0.09)) {
      const from = Math.max(booking.bookedAt.getTime(), after);
      const span = booking.start.getTime() - 30 * MINUTE - from;
      if (span > HOUR) {
        booking.cancelledAt = new Date(from + rng.next() * span);
        booking.cancelReason = rng.pick(CANCELLATION_REASONS);
        return;
      }
    }
    if (booking.end.getTime() > now) return;

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
    const recent = now - arrival.getTime() < 2 * DAY;
    const closedAt =
      recent && rng.chance(0.45)
        ? null
        : new Date(
            Math.min(
              Math.max(arrival.getTime() + rng.int(10, 90) * MINUTE, after),
              now - MINUTE,
            ),
          );
    booking.flight = {
      ...(booking.flight?.planned ? booking.flight : {}),
      booking,
      hours: Math.round((flightMinutes / 60) * 100) / 100,
      departure,
      arrival,
      origin: BASE.icao,
      destination: booking.destination ?? BASE.icao,
      closedAt,
      remarks: rng.pick(FLIGHT_REMARKS),
      passengers: booking.passengers,
      planned: false,
    };
  }
}

// Who flies along: friends on a tourist flight, now and then someone on a
// local or cross-country flight.
const passengersFor = (
  rng: Random,
  category: FlightCategory,
  trip: boolean,
  aircraft: FleetAircraft,
): number => {
  if (category === FlightCategory.TOURISM) {
    return rng.int(1, Math.min(3, aircraft.seats - 1));
  }
  return category === FlightCategory.LOCAL || trip ? rng.int(0, 1) : 0;
};

export const lessonPurpose = (lesson: number): string =>
  `Leçon ${lesson + 1} — ${LESSONS[lesson].title}`;

const flightSlotMinutes = (
  rng: Random,
  slot: number,
  category: FlightCategory,
  destination: { hours: number } | null,
): number => {
  if (destination) {
    return roundTo((destination.hours + rng.pick([0.5, 0.75, 1])) * 60, slot);
  }
  return category === FlightCategory.TOURISM
    ? roundTo(rng.int(90, 150), slot)
    : roundTo(rng.int(60, 120), slot);
};

const flightPurpose = (
  rng: Random,
  category: FlightCategory,
  withInstructor: boolean,
  destination: { icao: string; name: string } | null,
): string => {
  if (withInstructor) return 'Vol d’entraînement avec instructeur';
  if (destination) {
    return `Navigation ${BASE.icao} – ${destination.icao} (${destination.name})`;
  }
  if (category === FlightCategory.TOURISM) return rng.pick(WEEKEND_PURPOSES);
  if (category === FlightCategory.TRAINING) {
    return 'Entraînement pannes et tours de piste';
  }
  return rng.pick(LOCAL_PURPOSES);
};

export const planSchedule = (input: ScheduleInput): ScheduleResult => {
  const { days, members } = input;
  const scheduler = new Scheduler(input);

  if (input.instruction) {
    for (const student of members.filter((m) => m.kind === 'student')) {
      scheduler.planLessons(
        student,
        {
          lesson: 0,
          cursor: Math.max(
            student.joined.getTime() + 3 * DAY,
            days[0].start.getTime(),
          ),
          upcoming: 0,
        },
        days,
      );
    }
  }

  const presenter = members.find((m) => m.login === 'pilot');
  if (presenter) {
    for (const [icao, fromOffset] of PRESENTER_TRIPS) {
      scheduler.planTrip(presenter, icao, fromOffset, days);
    }
  }

  for (const day of days) {
    const wanted = Math.round(
      dayDemand(scheduler.rng, day) * bookedShare(day.offset),
    );
    scheduler.fillDay(day, wanted);
  }

  const bookings = scheduler.bookings;
  bookings.sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const booking of bookings) scheduler.settle(booking);
  return { bookings, courses: scheduler.courses };
};
