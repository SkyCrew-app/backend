import { EntityManager } from 'typeorm';
import { clubDayStart } from '../../modules/reservations/booking-rules';
import { FlightCategory } from '../../modules/reservations/entity/reservations.entity';
import { INSTRUCTION_COUNTS_IN_INSTRUCTOR_TOTAL } from '../../modules/flights/flight-rules';
import { CourseStatus } from '../../modules/instruction-courses/enum/course-status.enum';
import { CourseCompetency } from '../../modules/instruction-courses/entity/course-competency.entity';
import { CourseComment } from '../../modules/instruction-courses/entity/course-comment.entity';
import { BASE, DESTINATIONS, LESSONS } from './content';
import { clubDays, ClubDay, DAY } from './calendar';
import { feeDay, FUTURE_DAYS } from './build';
import { randomFor } from './random';
import {
  Accounts,
  bookingEvents,
  feeEvent,
  LedgerEvent,
  refundEvent,
  SHOWCASE_INVOICE_PREFIX,
} from './ledger';
import {
  bookingNotifications,
  DraftExpense,
  DraftMaintenance,
  NoticeParts,
  planExpenses,
} from './activity';
import { balanceSign } from '../../modules/payments/entity/payments.entity';
import {
  instructorFeeCents,
  priceCents,
} from '../../modules/reservations/booking-rules';
import {
  Agenda,
  bookingProblem,
  bookedShare,
  dayDemand,
  lessonPurpose,
  LessonProgress,
  PRESENTER_TRIPS,
  Scheduler,
} from './schedule';
import {
  DraftAdminAction,
  DraftBooking,
  DraftCourse,
  DraftInvoice,
  DraftMember,
  DraftNotification,
  DraftPayment,
} from './model';
import { ARTICLES } from './library';
import { expenseKey, ShowcaseAircraft, ShowcaseWorld } from './world';
import { ShowcaseTracker } from './tracker';
import {
  courseCommentRows,
  courseCompetencyRows,
  tripBookings,
  WriteContext,
  writeAdminActions,
  writeBookings,
  writeChecklists,
  writeCourses,
  writeExpenses,
  writeFlightPlans,
  writeFlights,
  writeMoney,
  writeNotifications,
} from './writer';

const MINUTE = 60_000;

// Bringing the showcase up to date before a presentation: what the
// generator would have made happen between the last refresh (or the
// creation) and now, and the bookings ahead of now. The same decisions as
// the generator, by the same functions; each one drawn from a generator of
// its own (seed + what it is about), so that running it again changes
// nothing.

// How many voluntary top-ups: one chance in this many days per member.
const TOP_UP_PERIOD_DAYS = 20;
// Flight plans prepared on the next trips, as the generator does.
const PLANNED_TRIPS = 6;

export interface RefreshPlan {
  now: Date;
  since: Date;
  // Bookings made since (cancelled ones included: they only take an id).
  newBookings: DraftBooking[];
  // Bookings of the showcase cancelled since: the API deletes them.
  cancelled: DraftBooking[];
  // Bookings flown since: a flight is written (or the plan is closed).
  flown: DraftBooking[];
  // Flights left open by their pilot and closed since.
  closed: DraftBooking[];
  newCourses: DraftCourse[];
  // Courses of the showcase settled or given another lesson since.
  changedCourses: DraftCourse[];
  hours: Map<DraftMember, number>;
  aircraftHours: Map<ShowcaseAircraft, number>;
  payments: DraftPayment[];
  invoices: DraftInvoice[];
  invoiceLastNumber: number;
  balances: Map<DraftMember, number>;
  adminActions: DraftAdminAction[];
  notifications: DraftNotification[];
  expenses: DraftExpense[];
  completedMaintenances: DraftMaintenance[];
  trips: DraftBooking[];
  articles: { id: number; createdAt: Date; eventDate: Date | null }[];
}

const dayKey = (date: Date) => clubDayStart(date).toISOString();

const minuteOf = (date: Date) => Math.floor(date.getTime() / MINUTE);

// Whole club days from the day of `from` to the day of `to`.
const daysBetween = (from: Date, to: Date) =>
  Math.round((clubDayStart(to).getTime() - clubDayStart(from).getTime()) / DAY);

const addTo = <K>(map: Map<K, number>, key: K, value: number) =>
  map.set(key, (map.get(key) ?? 0) + value);

// A course the generator or the API has not given an outcome yet: still
// scheduled, or completed by the API's nightly job without any feedback.
const unsettled = (course: DraftCourse) =>
  course.status === 'SCHEDULED' ||
  course.status === 'IN_PROGRESS' ||
  (course.status === 'COMPLETED' &&
    course.feedback === null &&
    course.competencies.every((k) => !k.validated));

// A course is given the competencies of another lesson.
const relabel = (course: DraftCourse, lesson: number) => {
  const definition = LESSONS[lesson];
  course.lesson = lesson;
  course.competencies = definition.competencies.map(([name, description]) => ({
    name,
    description,
    validated: false,
    validatedAt: null,
  }));
  if (course.booking) {
    course.booking.purpose = lessonPurpose(lesson);
    course.booking.destination = definition.title.includes('navigation')
      ? DESTINATIONS[lesson % 3].icao
      : null;
  }
};

interface Context {
  world: ShowcaseWorld;
  now: Date;
  scheduler: Scheduler;
  days: ClubDay[];
}

// The lesson a student is at after a course that has its outcome.
const lessonAfter = (course: DraftCourse): number | null => {
  if (course.status === 'CANCELED') return course.lesson;
  if (course.status !== 'COMPLETED') return null;
  const passed = course.competencies.every((k) => k.validated);
  return course.lesson + (passed ? 1 : 0);
};

// A student's courses in order: those whose time has come get their
// outcome, those ahead follow the syllabus from there. Returns the lesson
// the student is at.
const settleCourses = (
  ctx: Context,
  plan: RefreshPlan,
  notices: Map<DraftBooking, NoticeParts>,
  own: DraftCourse[],
): number | null => {
  const { world, now, scheduler } = ctx;
  let expected: number | null = null;
  for (const course of own) {
    const booking = course.booking;
    if (!unsettled(course) || !booking) {
      expected = lessonAfter(course) ?? expected;
      continue;
    }
    if (world.untouchable.has(booking)) continue;
    expected ??= course.lesson;
    const lesson = Math.min(expected, LESSONS.length - 1);
    let changed = course.lesson !== lesson;
    if (changed) relabel(course, lesson);
    if (booking.end.getTime() <= now.getTime()) {
      // Completed by the API's nightly job already: not cancelled then.
      const wasScheduled = course.status !== 'COMPLETED';
      scheduler.rng = randomFor(world.seed, 'course', course.id ?? 0);
      if (scheduler.settleCourse(course, wasScheduled)) expected++;
      changed = true;
      if (wasScheduled) {
        notices.set(booking, { booked: false, cancelled: true, course: true });
      }
    }
    if (changed) plan.changedCourses.push(course);
  }
  return expected;
};

// The students' lessons: those whose time has come get their outcome, and
// the next ones are planned roughly weekly from the last one.
const planLessons = (
  ctx: Context,
  plan: RefreshPlan,
  notices: Map<DraftBooking, NoticeParts>,
) => {
  const { world, now, scheduler, days } = ctx;
  const seed = world.seed;
  for (const student of world.members.filter((m) => m.kind === 'student')) {
    if (!student.instructor) continue;
    const own = world.courses
      .filter((c) => c.student === student)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const lesson = settleCourses(ctx, plan, notices, own) ?? 0;
    if (lesson >= LESSONS.length) continue;
    const progress: LessonProgress = {
      lesson,
      cursor: 0,
      upcoming: own.filter(
        (c) =>
          c.status === 'SCHEDULED' &&
          c.booking &&
          c.booking.end.getTime() > now.getTime(),
      ).length,
    };
    // Each step after a lesson is drawn from that lesson's day: the next
    // refresh resumes exactly where this one stopped.
    const resumeAfter = (course: DraftCourse) => {
      const day = clubDayStart(course.start);
      scheduler.rng = randomFor(seed, 'lessons', student.key, dayKey(day));
      progress.cursor = day.getTime() + scheduler.rng.int(6, 11) * DAY;
    };
    const last = own[own.length - 1];
    if (last) {
      resumeAfter(last);
    } else {
      scheduler.rng = randomFor(seed, 'lessons', student.key);
      progress.cursor = Math.max(
        student.joined.getTime() + 3 * DAY,
        days[0].start.getTime(),
      );
    }
    scheduler.planLessons(student, progress, days, (course) => {
      plan.newCourses.push(course);
      resumeAfter(course);
    });
  }
};

// The presentation pilot keeps three trips ahead (flight plans are made on
// them).
const planTrips = (ctx: Context) => {
  const { world, now, scheduler, days } = ctx;
  const presenter = world.members.find((m) => m.login === 'pilot');
  if (!presenter) return;
  const ahead = () =>
    [...world.bookings, ...scheduler.bookings].filter(
      (b) =>
        b.pilot === presenter &&
        b.category === FlightCategory.CROSS_COUNTRY &&
        b.start.getTime() > now.getTime() &&
        !b.cancelledAt,
    );
  for (const [icao, fromOffset] of PRESENTER_TRIPS) {
    const trips = ahead();
    if (trips.length >= PRESENTER_TRIPS.length) break;
    if (trips.some((b) => b.destination === icao)) continue;
    scheduler.rng = randomFor(
      world.seed,
      'trip',
      icao,
      dayKey(clubDayStart(now, fromOffset)),
    );
    scheduler.planTrip(presenter, icao, fromOffset, days);
  }
};

// The members' own flights: a day ahead is booked further as it comes
// nearer (half of its bookings three weeks ahead, all of them in the last
// week), a day never planned gets all of them.
const planDays = (ctx: Context) => {
  const { world, scheduler, days } = ctx;
  const booked = (day: ClubDay) =>
    [...world.bookings, ...scheduler.bookings].filter(
      (b) =>
        !b.course &&
        !b.cancelledAt &&
        b.start.getTime() >= day.start.getTime() &&
        b.start.getTime() < day.start.getTime() + DAY,
    ).length;
  for (const day of days) {
    const before = daysBetween(world.since, day.start);
    const share = bookedShare(day.offset);
    const shareBefore = before <= FUTURE_DAYS ? bookedShare(before) : 0;
    if (share <= shareBefore) continue;
    const demand = dayDemand(
      randomFor(world.seed, 'day', dayKey(day.start)),
      day,
    );
    const wanted = Math.round(demand * share) - booked(day);
    if (wanted <= 0) continue;
    scheduler.rng = randomFor(world.seed, 'day', dayKey(day.start), share);
    scheduler.fillDay(day, wanted);
  }
};

// A booking is known by its aircraft and start: the same from one refresh
// to the next, whether it was written yet or not.
const bookingKey = (b: DraftBooking) =>
  `${b.aircraft.key}@${b.start.toISOString()}`;

// When the pilot closes a flight: some time after landing, the most recent
// flights not always yet (null). The same flight gets the same answer from
// one refresh to the next while it is recent.
const closingOf = (
  world: ShowcaseWorld,
  booking: DraftBooking,
  now: Date,
): Date | null => {
  const flight = booking.flight!;
  const rng = randomFor(world.seed, 'close', bookingKey(booking));
  const recent = now.getTime() - flight.arrival.getTime() < 2 * DAY;
  if (rng.chance(0.45) && recent) return null;
  return new Date(
    Math.min(
      Math.max(flight.arrival.getTime(), world.since.getTime()) +
        rng.int(10, 90) * MINUTE,
      now.getTime() - MINUTE,
    ),
  );
};

// What happened to the bookings whose time has come: cancelled, flown and
// closed (the most recent ones not always yet).
const settleBookings = (ctx: Context, plan: RefreshPlan) => {
  const { world, now, scheduler } = ctx;
  const since = world.since.getTime();
  const candidates = [
    ...world.bookings.filter(
      (b) =>
        !world.untouchable.has(b) &&
        b.end.getTime() > since &&
        b.start.getTime() <= now.getTime() &&
        (!b.flight || b.flight.planned),
    ),
    ...scheduler.bookings,
  ].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const booking of candidates) {
    if (booking.cancelledAt) continue;
    scheduler.rng = randomFor(world.seed, 'settle', bookingKey(booking));
    scheduler.settle(booking);
    if (booking.cancelledAt) {
      if (booking.id !== undefined) plan.cancelled.push(booking);
      continue;
    }
    // Flown (a flight plan made ahead is the flight its pilot closes).
    if (booking.flight && !booking.flight.planned) {
      booking.flight.closedAt = closingOf(world, booking, now);
      plan.flown.push(booking);
    }
  }

  // The presentation pilot has a recent flight still to close.
  const presenter = world.members.find((m) => m.login === 'pilot');
  const toClose = plan.flown
    .filter(
      (b) =>
        b.pilot === presenter &&
        now.getTime() - b.flight!.arrival.getTime() < 12 * DAY,
    )
    .pop();
  if (toClose) toClose.flight!.closedAt = null;

  // Flights left open are closed after a while; the presentation pilot's
  // stays open while it is the one to close.
  for (const booking of world.bookings) {
    const flight = booking.flight;
    if (
      !flight?.id ||
      flight.planned ||
      flight.closedAt ||
      plan.flown.includes(booking) ||
      world.untouchable.has(booking)
    )
      continue;
    const presenterKeeps =
      booking.pilot === presenter &&
      !toClose &&
      now.getTime() - flight.arrival.getTime() < 12 * DAY;
    const closedAt = presenterKeeps ? null : closingOf(world, booking, now);
    if (!closedAt) continue;
    flight.closedAt = closedAt;
    plan.closed.push(booking);
  }

  // The hours of the flights closed count for the members on board and
  // the aircraft, as when the API closes a flight.
  for (const booking of [...plan.flown, ...plan.closed]) {
    const flight = booking.flight!;
    if (!flight.closedAt) continue;
    addTo(plan.hours, booking.pilot, flight.hours);
    if (booking.instructor && INSTRUCTION_COUNTS_IN_INSTRUCTOR_TOTAL) {
      addTo(plan.hours, booking.instructor, flight.hours);
    }
    addTo(
      plan.aircraftHours,
      booking.aircraft as ShowcaseAircraft,
      flight.hours,
    );
  }
};

// The members' accounts: bookings charged and refunded, the yearly fee,
// top-ups when needed and now and then ahead of need.
const planMoney = (ctx: Context, plan: RefreshPlan) => {
  const { world, now } = ctx;
  const since = world.since;
  const accounts = new Accounts(
    randomFor(world.seed, 'accounts', minuteOf(now)),
    now,
    world.treasurer,
  );
  const events = new Map<DraftMember, LedgerEvent[]>();
  const push = (event: LedgerEvent) =>
    events.set(event.member, [...(events.get(event.member) ?? []), event]);
  plan.newBookings.flatMap(bookingEvents).forEach(push);
  for (const booking of plan.cancelled) {
    if (booking.priceCents > 0) push(refundEvent(booking));
  }
  const feeCents = Math.round(Number(world.settings.membershipFee ?? 0) * 100);
  const firstYear = Number(since.toISOString().slice(0, 4));
  const lastYear = Number(now.toISOString().slice(0, 4));
  for (let year = firstYear; year <= lastYear && feeCents > 0; year++) {
    const at = feeDay(year);
    if (at.getTime() <= since.getTime() || at.getTime() > now.getTime()) {
      continue;
    }
    for (const member of world.members) {
      push(
        feeEvent(
          member,
          new Date(Math.max(at.getTime(), member.bookableFrom!.getTime())),
          feeCents,
          at,
        ),
      );
    }
  }

  for (const member of world.members) {
    const start = member.balanceCents;
    let { balance } = accounts.post(
      member,
      events.get(member) ?? [],
      start,
      member.bookableFrom!.getTime() - MINUTE,
    );
    // Now and then a member tops up ahead of need: one chance per period.
    if (member.kind !== 'technician') {
      const period = TOP_UP_PERIOD_DAYS * DAY;
      const phase = randomFor(world.seed, 'top-up', member.key).next() * period;
      for (
        let k = Math.floor((since.getTime() - phase) / period) + 1;
        phase + k * period <= now.getTime();
        k++
      ) {
        const at = new Date(phase + k * period);
        const rng = randomFor(world.seed, 'top-up', member.key, k);
        if (at.getTime() <= member.bookableFrom!.getTime() || !rng.chance(0.35))
          continue;
        const amount = rng.pick([200, 300, 500]) * 100;
        accounts.topUp(member, at, amount);
        balance += amount;
      }
    }
    if (balance !== start) plan.balances.set(member, balance - start);
    member.balanceCents = balance;
  }
  plan.invoiceLastNumber = accounts.close(world.invoiceLastNumber);
  plan.payments = accounts.payments;
  plan.invoices = accounts.invoices;
  plan.adminActions = accounts.adminActions;
  plan.notifications.push(...accounts.notifications);
};

export const planRefresh = (world: ShowcaseWorld, now: Date): RefreshPlan => {
  const since = world.since;
  const plan: RefreshPlan = {
    now,
    since,
    newBookings: [],
    cancelled: [],
    flown: [],
    closed: [],
    newCourses: [],
    changedCourses: [],
    hours: new Map(),
    aircraftHours: new Map(),
    payments: [],
    invoices: [],
    invoiceLastNumber: world.invoiceLastNumber,
    balances: new Map(),
    adminActions: [],
    notifications: [],
    expenses: [],
    completedMaintenances: [],
    trips: [],
    articles: [],
  };
  if (now.getTime() <= since.getTime()) return plan;

  // A maintenance whose last day is over is completed.
  for (const m of world.inProgress) {
    if (m.endDate.getTime() + DAY <= now.getTime()) {
      m.status = 'COMPLETED';
      plan.completedMaintenances.push(m);
    }
  }

  const agenda = new Agenda();
  for (const b of world.bookings) {
    agenda.take(`aircraft:${b.aircraft.key}`, b.start, b.end);
    agenda.take(`member:${b.pilot.key}`, b.start, b.end);
    if (b.instructor) agenda.take(`member:${b.instructor.key}`, b.start, b.end);
  }
  for (const span of world.busy) {
    for (const key of span.keys) agenda.take(key, span.start, span.end);
  }
  const days = clubDays(
    world.settings,
    now,
    -daysBetween(since, now),
    FUTURE_DAYS,
    BASE,
  );
  const scheduler = new Scheduler(
    {
      rng: randomFor(world.seed, 'refresh', minuteOf(now)),
      now,
      settings: world.settings,
      days,
      members: world.members,
      // A grounded aircraft is not booked.
      fleet: world.fleet.filter((a) => !a.grounded),
      maintenance: world.maintenance,
      instruction: world.instruction,
      historyStart: world.historyStart,
      settledAfter: since,
    },
    undefined,
    agenda,
  );
  const ctx: Context = { world, now, scheduler, days };
  const notices = new Map<DraftBooking, NoticeParts>();

  if (days.length > 0) {
    if (world.instruction) planLessons(ctx, plan, notices);
    planTrips(ctx);
    planDays(ctx);
  }
  plan.newBookings = scheduler.bookings;
  settleBookings(ctx, plan);
  for (const booking of plan.newBookings) {
    notices.set(booking, { booked: true, cancelled: true, course: true });
  }
  for (const booking of plan.cancelled) {
    if (!notices.has(booking)) {
      notices.set(booking, { booked: false, cancelled: true, course: false });
    }
  }
  planMoney(ctx, plan);

  // What the members were told about their bookings.
  const noticeRng = randomFor(world.seed, 'notices', minuteOf(now));
  for (const [booking, parts] of notices) {
    plan.notifications.push(
      ...bookingNotifications(noticeRng, now, booking, parts),
    );
  }
  plan.notifications = plan.notifications
    .filter(
      (n) =>
        n.date.getTime() > since.getTime() && n.date.getTime() <= now.getTime(),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  plan.adminActions.sort((a, b) => a.at.getTime() - b.at.getTime());

  // The club's expenses since, once per month each.
  const flights = [...world.bookings, ...plan.newBookings].filter(
    (b) => b.flight && !b.flight.planned && !b.cancelledAt,
  );
  // Months counted from the history's first, as the generator does (the
  // fees are paid every third month).
  plan.expenses = planExpenses(
    randomFor(world.seed, 'expenses', minuteOf(now)),
    now,
    world.historyStart,
    flights,
    plan.completedMaintenances,
    Number(world.settings.fuelPrice ?? 0),
    {
      after: since,
      rngOf: (month) => randomFor(world.seed, 'expenses', month.toISOString()),
    },
  ).filter(
    (e) =>
      e.category === 'Maintenance' ||
      !world.expenseKeys.has(expenseKey(e.category, e.sub, e.date)),
  );

  // Flight plans on the next trips, as many as the generator prepares.
  const active = [...world.bookings, ...plan.newBookings].filter(
    (b) => !b.cancelledAt,
  );
  const prepared = active.filter(
    (b) => b.flight?.planned && b.start.getTime() > now.getTime(),
  ).length;
  plan.trips = tripBookings(
    active.filter((b) => !b.flight && !world.untouchable.has(b)),
    now,
    PLANNED_TRIPS - prepared,
  );

  // The news keep their place relative to now.
  for (const article of world.articles) {
    const content = ARTICLES.find((a) => a.title === article.title);
    if (!content) continue;
    plan.articles.push({
      id: article.id,
      createdAt: new Date(now.getTime() + content.days * DAY),
      eventDate:
        content.event == null
          ? null
          : new Date(now.getTime() + content.event * DAY),
    });
  }
  return plan;
};

// ---------- Writing ----------

const round2 = (value: number) => Math.round(value * 100) / 100;

// Rows of the showcase removed by a refresh (a booking cancelled, the
// competencies of a course replaced) leave its list too.
const untrack = async (
  manager: EntityManager,
  entity: string,
  ids: number[],
) => {
  if (ids.length === 0) return;
  await manager.query(
    `DELETE FROM "showcase_items" WHERE "entity" = $1 AND "row_id" = ANY($2::text[])`,
    [entity, ids.map(String)],
  );
};

// Cancelled as the API does (ReservationsService.delete): the course stays
// without its booking, a checklist is kept without it, the booking goes.
const writeCancellations = async (
  manager: EntityManager,
  bookings: DraftBooking[],
) => {
  const ids = bookings.map((b) => b.id!);
  if (ids.length === 0) return;
  await manager.query(
    `UPDATE "instruction_courses" SET "reservationId" = NULL WHERE "reservationId" = ANY($1::int[])`,
    [ids],
  );
  await manager.query(
    `UPDATE "checklist_submissions" SET "reservationId" = NULL WHERE "reservationId" = ANY($1::int[])`,
    [ids],
  );
  await manager.query(
    `DELETE FROM "reservations" WHERE "id" = ANY($1::int[])`,
    [ids],
  );
  await untrack(manager, 'reservations', ids);
};

const writeChangedCourses = async (
  ctx: WriteContext,
  courses: DraftCourse[],
) => {
  const { manager, tracker } = ctx;
  for (const course of courses) {
    const booking = course.booking;
    await manager.query(
      `UPDATE "instruction_courses" SET "status" = $2, "feedback" = $3, "rating" = $4, "reservationId" = $5 WHERE "id" = $1`,
      [
        course.id,
        CourseStatus[course.status],
        course.feedback,
        course.rating,
        booking && !booking.cancelledAt ? booking.id : null,
      ],
    );
    if (booking && !booking.cancelledAt) {
      await manager.query(
        `UPDATE "reservations" SET "purpose" = $2 WHERE "id" = $1`,
        [booking.id, booking.purpose],
      );
    }
    const old: { id: number }[] = await manager.query(
      `DELETE FROM "course_competencies" WHERE "courseId" = $1 AND "id"::text IN (SELECT "row_id" FROM "showcase_items" WHERE "entity" = 'course_competencies') RETURNING "id"`,
      [course.id],
    );
    await untrack(
      manager,
      'course_competencies',
      old.map((row) => Number(row.id)),
    );
    await tracker.insert(CourseCompetency, courseCompetencyRows(course));
    await tracker.insert(CourseComment, courseCommentRows(course));
  }
};

const writeFlown = async (ctx: WriteContext, plan: RefreshPlan) => {
  const { manager } = ctx;
  const flown = plan.flown.filter((b) => !b.flight!.id);
  await writeFlights(ctx, flown);
  // A flight plan made ahead is the flight: its pilot closes it.
  for (const booking of plan.flown.filter((b) => b.flight!.id)) {
    const f = booking.flight!;
    await manager.query(
      `UPDATE "flights" SET "flight_hours" = $2, "departure_time" = $3, "arrival_time" = $4, "remarks" = $5, "number_of_passengers" = $6, "closed_at" = $7, "flight_type" = $8 WHERE "id" = $1`,
      [
        f.id,
        f.hours,
        f.departure,
        f.arrival,
        f.remarks,
        f.passengers,
        f.closedAt,
        booking.category,
      ],
    );
  }
  for (const booking of plan.closed) {
    await manager.query(
      `UPDATE "flights" SET "closed_at" = $2 WHERE "id" = $1`,
      [booking.flight!.id, booking.flight!.closedAt],
    );
  }
  for (const [member, hours] of plan.hours) {
    await manager.increment(
      'users',
      { id: member.id },
      'total_flight_hours',
      round2(hours),
    );
  }
  for (const [aircraft, hours] of plan.aircraftHours) {
    await manager.increment(
      'aircraft',
      { id: aircraft.id },
      'total_flight_hours',
      round2(hours),
    );
  }
};

export interface RefreshOutcome {
  counts: Record<string, number>;
  warnings: string[];
}

// Writes a refresh. Rows of others are never written to; rows of the
// showcase are added, and a few of them changed or removed as the API
// would (a booking cancelled, a flight closed, a course completed).
export const writeRefresh = async (
  manager: EntityManager,
  world: ShowcaseWorld,
  plan: RefreshPlan,
): Promise<RefreshOutcome> => {
  const tracker = new ShowcaseTracker(manager);
  const aircraftIds = new Map(world.fleet.map((a) => [a.key, a.id]));
  const ctx: WriteContext = {
    manager,
    tracker,
    rng: randomFor(world.seed, 'write', minuteOf(plan.now)),
    aircraftId: (aircraft) => aircraftIds.get(aircraft.key)!,
  };
  const warnings: string[] = [];

  for (const m of plan.completedMaintenances) {
    await manager.query(
      `UPDATE "maintenance" SET "status" = 'COMPLETED' WHERE "id" = $1`,
      [m.id],
    );
  }
  await writeCancellations(manager, plan.cancelled);
  await writeBookings(ctx, plan.newBookings);
  await writeCourses(ctx, plan.newCourses);
  await writeChangedCourses(ctx, plan.changedCourses);
  await writeFlown(ctx, plan);
  await writeMoney(ctx, plan.invoices, plan.payments);
  for (const [member, cents] of plan.balances) {
    await manager.query(
      `UPDATE "users" SET "user_account_balance" = "user_account_balance" + $1::numeric WHERE "id" = $2`,
      [(cents / 100).toFixed(2), member.id],
    );
  }
  await writeChecklists(
    ctx,
    plan.flown.filter((b) => !b.cancelledAt),
    world.checklists,
    plan.now,
  );
  await writeExpenses(ctx, plan.expenses);
  warnings.push(...(await writeFlightPlans(ctx, plan.trips, plan.now)));
  await writeAdminActions(ctx, plan.adminActions);
  await writeNotifications(ctx, plan.notifications);
  for (const article of plan.articles) {
    await manager.query(
      `UPDATE "article" SET "createdAt" = $2, "updatedAt" = $2, "eventDate" = $3 WHERE "id" = $1`,
      [article.id, article.createdAt, article.eventDate],
    );
  }
  await manager.query(
    `UPDATE "showcase_state" SET "refreshed_at" = $1, "invoice_last_number" = $2 WHERE "id" = 1`,
    [plan.now, plan.invoiceLastNumber],
  );
  return { counts: Object.fromEntries(tracker.counts), warnings };
};

export const refreshSummary = (plan: RefreshPlan) => {
  const active = plan.newBookings.filter((b) => !b.cancelledAt);
  return {
    from: plan.since.toISOString(),
    to: plan.now.toISOString(),
    bookings: active.length,
    upcomingBookings: active.filter(
      (b) => b.start.getTime() > plan.now.getTime(),
    ).length,
    cancelledBookings:
      plan.cancelled.length + plan.newBookings.length - active.length,
    flightsFlown: plan.flown.length,
    flightsClosed:
      plan.flown.filter((b) => b.flight!.closedAt).length + plan.closed.length,
    hoursClosed: round2(
      [...plan.aircraftHours.values()].reduce((sum, h) => sum + h, 0),
    ),
    newCourses: plan.newCourses.length,
    coursesSettled: plan.changedCourses.length,
    payments: plan.payments.length,
    invoices: plan.invoices.length,
    expenses: plan.expenses.length,
    notifications: plan.notifications.length,
    maintenancesCompleted: plan.completedMaintenances.length,
    flightPlans: plan.trips.length,
  };
};

type Say = (text: string) => void;

const nameOf = (b: DraftBooking) =>
  `${b.aircraft.registration} ${b.start.toISOString()} ${b.pilot.key}`;

const outside = (date: Date, plan: RefreshPlan) =>
  date.getTime() <= plan.since.getTime() || date.getTime() > plan.now.getTime();

// New bookings made between the last refresh and now by the rules; what
// happened to the others after their time came.
const bookingProblems = (world: ShowcaseWorld, plan: RefreshPlan, say: Say) => {
  const rules = {
    settings: world.settings,
    maintenance: world.maintenance,
    instruction: world.instruction,
  };
  for (const booking of plan.newBookings) {
    const name = nameOf(booking);
    const problem = bookingProblem(rules, new Agenda(), booking);
    if (problem) say(`booking ${name}: ${problem}`);
    const expected =
      priceCents(booking.aircraft.hourlyCost, booking.start, booking.end) +
      instructorFeeCents(
        booking.instructor !== null,
        booking.start,
        booking.end,
      );
    if (booking.priceCents !== expected) say(`booking ${name}: price`);
    if (outside(booking.bookedAt, plan)) {
      say(`booking ${name}: booked outside the refresh`);
    }
    if ((booking.aircraft as ShowcaseAircraft).grounded) {
      say(`booking ${name}: grounded aircraft`);
    }
  }
  for (const booking of [...plan.cancelled, ...plan.newBookings]) {
    const at = booking.cancelledAt;
    if (at && (outside(at, plan) || at.getTime() >= booking.start.getTime())) {
      say(`booking ${nameOf(booking)}: cancellation date`);
    }
  }
  for (const booking of [...plan.flown, ...plan.closed]) {
    const flight = booking.flight!;
    const name = nameOf(booking);
    if (booking.end.getTime() > plan.now.getTime() || booking.cancelledAt) {
      say(`booking ${name}: flight before the end`);
    }
    if (
      flight.departure.getTime() < booking.start.getTime() ||
      flight.arrival.getTime() > booking.end.getTime() ||
      flight.arrival.getTime() <= flight.departure.getTime()
    ) {
      say(`booking ${name}: flight times`);
    }
    const closed = flight.closedAt;
    if (
      closed &&
      (closed.getTime() < flight.arrival.getTime() ||
        closed.getTime() > plan.now.getTime())
    ) {
      say(`booking ${name}: closing date`);
    }
  }
};

// Nobody and no aircraft in two places at once, the bookings of others
// included.
const overlapProblems = (world: ShowcaseWorld, plan: RefreshPlan, say: Say) => {
  const spans = new Map<string, { start: Date; end: Date; what: string }[]>();
  const take = (key: string, start: Date, end: Date, what: string) =>
    spans.set(key, [...(spans.get(key) ?? []), { start, end, what }]);
  const cancelled = new Set(plan.cancelled);
  for (const b of [...world.bookings, ...plan.newBookings]) {
    if (b.cancelledAt || cancelled.has(b)) continue;
    const keys = [`aircraft:${b.aircraft.key}`, `member:${b.pilot.key}`];
    if (b.instructor) keys.push(`member:${b.instructor.key}`);
    for (const key of keys) take(key, b.start, b.end, nameOf(b));
  }
  for (const span of world.busy) {
    for (const key of span.keys) take(key, span.start, span.end, 'another');
  }
  const from = plan.since.getTime() - DAY;
  for (const [key, list] of spans) {
    list.sort((a, b) => a.start.getTime() - b.start.getTime());
    for (let i = 1; i < list.length; i++) {
      const start = list[i].start.getTime();
      if (start < list[i - 1].end.getTime() && start >= from) {
        say(`${key}: ${list[i - 1].what} overlaps ${list[i].what}`);
      }
    }
  }
};

// No line takes a balance below zero, in date order from the balance
// before the refresh; the invoices continue the showcase's series.
const moneyProblems = (world: ShowcaseWorld, plan: RefreshPlan, say: Say) => {
  for (const member of world.members) {
    const lines = plan.payments
      .filter((p) => p.member === member && p.status === 'completed')
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    let balance = member.balanceCents - (plan.balances.get(member) ?? 0);
    for (const line of lines) {
      balance += balanceSign(line.kind) * line.amountCents;
      if (balance < 0) {
        say(`${member.key}: balance below zero on ${line.date.toISOString()}`);
      }
      if (outside(line.date, plan)) {
        say(`${member.key}: line dated outside the refresh`);
      }
    }
    if (balance !== member.balanceCents) say(`${member.key}: balance`);
  }
  plan.invoices.forEach((invoice, index) => {
    const sequence = world.invoiceLastNumber + index + 1;
    if (
      !invoice.number.startsWith(`${SHOWCASE_INVOICE_PREFIX}-`) ||
      !invoice.number.endsWith(String(sequence).padStart(5, '0'))
    ) {
      say(`invoice ${invoice.number}: numbering`);
    }
  });
  if (
    plan.invoiceLastNumber !==
    world.invoiceLastNumber + plan.invoices.length
  ) {
    say('invoice counter');
  }
};

// Everything the API would refuse, looked for in a refresh. Empty when it
// holds every rule; nothing is written otherwise.
export const refreshProblems = (
  world: ShowcaseWorld,
  plan: RefreshPlan,
): string[] => {
  const problems: string[] = [];
  const say = (text: string) => {
    if (problems.length < 50) problems.push(text);
  };
  bookingProblems(world, plan, say);
  overlapProblems(world, plan, say);
  moneyProblems(world, plan, say);
  return problems;
};
