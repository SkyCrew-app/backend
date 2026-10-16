import { Random } from './random';
import { clubDays, clubAccepts, DAY, HOUR } from './calendar';
import { buildFleet, FleetAircraft } from './fleet';
import { BASE, SHOWCASE_EMAIL_DOMAIN } from './content';
import { buildRoster } from './roster';
import {
  bookingProblem,
  planSchedule,
  ScheduleSettings,
  Window,
  Agenda,
} from './schedule';
import { balanceOfLines, buildLedger, SHOWCASE_INVOICE_PREFIX } from './ledger';
import {
  activityNotifications,
  DraftExpense,
  DraftIncident,
  DraftMaintenance,
  DraftReport,
  licenceValidations,
  maintenanceWindows,
  planExpenses,
  planIncidents,
  planMaintenances,
  planReports,
} from './activity';
import {
  DraftAdminAction,
  DraftBooking,
  DraftCourse,
  DraftInvoice,
  DraftMember,
  DraftNotification,
  DraftPayment,
} from './model';
import {
  clubDayStart,
  instructorFeeCents,
  priceCents,
} from '../../modules/reservations/booking-rules';
import { balanceSign } from '../../modules/payments/entity/payments.entity';

// Six months of history, three weeks of bookings ahead.
export const HISTORY_DAYS = 183;
export const FUTURE_DAYS = 21;

export interface ShowcaseSettings extends ScheduleSettings {
  membershipFee?: number | null;
  fuelPrice?: number | null;
}

export interface BuildInput {
  now: Date;
  seed: number;
  settings: ShowcaseSettings;
  // Whether the plan of the installation includes instruction.
  instruction: boolean;
}

export interface ShowcasePlan {
  now: Date;
  seed: number;
  historyStart: Date;
  members: DraftMember[];
  fleet: (FleetAircraft & {
    id?: number;
    totalHours: number;
    grounded: boolean;
  })[];
  maintenances: DraftMaintenance[];
  maintenance: Map<string, Window[]>;
  bookings: DraftBooking[];
  courses: DraftCourse[];
  incidents: DraftIncident[];
  groundedAt: Date | null;
  payments: DraftPayment[];
  invoices: DraftInvoice[];
  invoiceLastNumber: number;
  adminActions: DraftAdminAction[];
  notifications: DraftNotification[];
  expenses: DraftExpense[];
  reports: DraftReport[];
  instruction: boolean;
  settings: ShowcaseSettings;
}

// The day the yearly fee is called (3 September, 10:00 at the club), when
// it falls within the history.
const feeDateWithin = (now: Date, historyStart: Date): Date | null => {
  const year = Number(now.toISOString().slice(0, 4));
  for (const candidate of [year, year - 1]) {
    const date = new Date(
      clubDayStart(new Date(Date.UTC(candidate, 8, 3, 12))).getTime() +
        10 * HOUR,
    );
    if (
      date.getTime() <= now.getTime() - DAY &&
      date.getTime() >= historyStart.getTime()
    ) {
      return date;
    }
  }
  return null;
};

export const buildShowcase = (input: BuildInput): ShowcasePlan => {
  const { now, settings, instruction } = input;
  const rng = new Random(input.seed);
  const historyStart = clubDayStart(now, -HISTORY_DAYS);
  // The first day of the history is the day the accounts were opened.
  const days = clubDays(settings, now, -HISTORY_DAYS + 1, FUTURE_DAYS, BASE);
  if (days.length < 30) {
    throw new Error(
      'Showcase: the club settings leave too few open days to plan a showcase',
    );
  }

  const members = buildRoster(
    rng,
    now,
    historyStart,
    settings.pilotLicenses,
    instruction,
  );
  const office = members.filter((m) => m.kind === 'office');
  const technician = members.find((m) => m.kind === 'technician')!;
  const fleet = buildFleet();
  // The Warrior is grounded by an incident, the DA40 in maintenance:
  // neither is used for courses.
  const grounded = fleet.find((a) => a.key === 'pa28-161')!;
  const inMaintenance = fleet.find((a) => a.key === 'da40')!;

  const maintenances = planMaintenances(
    rng,
    now,
    days,
    fleet,
    technician,
    inMaintenance,
  );
  const maintenance = maintenanceWindows(maintenances);
  const schedule = planSchedule({
    rng,
    now,
    settings,
    days,
    members,
    fleet,
    maintenance,
    instruction,
    historyStart,
  });
  const incidents = planIncidents(
    rng,
    now,
    schedule.bookings,
    grounded,
    technician,
    office,
  );
  const bookings = schedule.bookings.filter(
    (b) => !(b as { dropped?: boolean }).dropped,
  );

  // The presentation pilot has a recent flight still to close.
  const loginPilot = members.find((m) => m.login === 'pilot');
  const toClose = bookings
    .filter(
      (b) =>
        b.pilot === loginPilot &&
        b.flight &&
        now.getTime() - b.flight.arrival.getTime() < 12 * DAY,
    )
    .pop();
  if (toClose) toClose.flight!.closedAt = null;

  // Hours of the closed flights, for the members on board and the aircraft.
  const aircraftHours = new Map<string, number>();
  for (const booking of bookings) {
    const flight = booking.flight;
    if (!flight?.closedAt) continue;
    booking.pilot.closedHours += flight.hours;
    if (booking.instructor) booking.instructor.closedHours += flight.hours;
    aircraftHours.set(
      booking.aircraft.key,
      (aircraftHours.get(booking.aircraft.key) ?? 0) + flight.hours,
    );
  }

  const ledger = buildLedger({
    rng,
    now,
    historyStart,
    members,
    bookings,
    treasurer: office[1] ?? office[0],
    membershipFee: Number(settings.membershipFee ?? 0),
    feeDate: feeDateWithin(now, historyStart),
  });

  const expenses = planExpenses(
    rng,
    now,
    historyStart,
    bookings,
    maintenances,
    Number(settings.fuelPrice ?? 0),
  );
  const reports = planReports(
    now,
    historyStart,
    bookings,
    expenses,
    members.length,
  );

  return {
    now,
    seed: input.seed,
    historyStart,
    members,
    fleet: fleet.map((aircraft) => ({
      ...aircraft,
      totalHours:
        Math.round(
          (aircraft.priorHours + (aircraftHours.get(aircraft.key) ?? 0)) * 100,
        ) / 100,
      grounded: aircraft === grounded && incidents.groundedAt !== null,
    })),
    maintenances,
    maintenance,
    bookings,
    courses: schedule.courses,
    incidents: incidents.incidents,
    groundedAt: incidents.groundedAt,
    payments: ledger.payments,
    invoices: ledger.invoices,
    invoiceLastNumber: ledger.invoiceLastNumber,
    adminActions: [
      ...ledger.adminActions,
      ...incidents.adminActions,
      ...licenceValidations(historyStart, members, office[0]),
    ].sort((a, b) => a.at.getTime() - b.at.getTime()),
    notifications: [
      ...ledger.notifications,
      ...incidents.notifications,
      ...activityNotifications(rng, now, bookings, members),
    ]
      .filter((n) => n.date.getTime() <= now.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime()),
    expenses,
    reports,
    instruction,
    settings,
  };
};

// Everything the API would refuse, looked for in a plan. Empty when the
// plan holds every rule; `create` writes nothing otherwise.
export const planProblems = (plan: ShowcasePlan): string[] => {
  const problems: string[] = [];
  const { now } = plan;
  const say = (text: string) => {
    if (problems.length < 50) problems.push(text);
  };
  const name = (b: DraftBooking) =>
    `${b.aircraft.registration} ${b.start.toISOString()} ${b.pilot.key}`;

  // Bookings: the slot, the club, the licence, the price, the maintenance.
  const active = plan.bookings.filter((b) => !b.cancelledAt);
  for (const booking of plan.bookings) {
    const problem = bookingProblem(
      {
        settings: plan.settings,
        maintenance: plan.maintenance,
        instruction: plan.instruction,
      },
      new Agenda(),
      booking,
    );
    if (problem) say(`booking ${name(booking)}: ${problem}`);
    const expected =
      priceCents(booking.aircraft.hourlyCost, booking.start, booking.end) +
      instructorFeeCents(
        booking.instructor !== null,
        booking.start,
        booking.end,
      );
    if (booking.priceCents !== expected) say(`booking ${name(booking)}: price`);
    if (booking.bookedAt.getTime() > now.getTime())
      say(`booking ${name(booking)}: booked in the future`);
    if (!clubAccepts(plan.settings, booking.start, booking.end))
      say(`booking ${name(booking)}: club closed`);
    if (booking.cancelledAt) {
      if (
        booking.cancelledAt.getTime() <= booking.bookedAt.getTime() ||
        booking.cancelledAt.getTime() > now.getTime()
      ) {
        say(`booking ${name(booking)}: cancellation date`);
      }
      if (booking.flight)
        say(`booking ${name(booking)}: flight on a cancelled booking`);
    }
    if (booking.course && booking.course.booking !== booking)
      say(`booking ${name(booking)}: course link`);
    const flight = booking.flight;
    if (flight) {
      if (booking.end.getTime() > now.getTime())
        say(`booking ${name(booking)}: flight before the end`);
      if (
        flight.departure.getTime() < booking.start.getTime() ||
        flight.arrival.getTime() > booking.end.getTime() ||
        flight.arrival.getTime() <= flight.departure.getTime()
      ) {
        say(`booking ${name(booking)}: flight times`);
      }
      const minutes =
        (flight.arrival.getTime() - flight.departure.getTime()) / 60_000;
      if (Math.abs(minutes / 60 - flight.hours) > 0.01)
        say(`booking ${name(booking)}: flight hours`);
      if (
        flight.closedAt &&
        flight.closedAt.getTime() < flight.arrival.getTime()
      ) {
        say(`booking ${name(booking)}: closed before landing`);
      }
    }
  }
  // Nobody and no aircraft in two places at once.
  const byKey = new Map<string, DraftBooking[]>();
  for (const booking of active) {
    const keys = [
      `aircraft:${booking.aircraft.key}`,
      `member:${booking.pilot.key}`,
      ...(booking.instructor ? [`member:${booking.instructor.key}`] : []),
    ];
    for (const key of keys) {
      const list = byKey.get(key) ?? [];
      list.push(booking);
      byKey.set(key, list);
    }
  }
  for (const [key, list] of byKey) {
    list.sort((a, b) => a.start.getTime() - b.start.getTime());
    for (let i = 1; i < list.length; i++) {
      if (list[i].start.getTime() < list[i - 1].end.getTime()) {
        say(`${key}: ${name(list[i - 1])} overlaps ${name(list[i])}`);
      }
    }
  }
  // A grounded aircraft flies no more.
  if (plan.groundedAt) {
    const grounded = plan.fleet.find((a) => a.grounded)!;
    for (const booking of active) {
      if (
        booking.aircraft.key === grounded.key &&
        booking.start.getTime() >= plan.groundedAt.getTime()
      ) {
        say(`booking ${name(booking)}: grounded aircraft`);
      }
    }
  }

  // Money: no debit beyond the balance, balance = sum of the lines.
  for (const member of plan.members) {
    const lines = plan.payments
      .filter((p) => p.member === member)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    let balance = 0;
    for (const line of lines) {
      if (line.status !== 'completed') continue;
      balance += balanceSign(line.kind) * line.amountCents;
      if (balance < 0)
        say(`${member.key}: balance below zero on ${line.date.toISOString()}`);
      if (line.date.getTime() > now.getTime())
        say(`${member.key}: payment in the future`);
      if (
        (line.kind === 'manual_credit' || line.kind === 'manual_debit') &&
        !(line.reason && line.createdBy)
      ) {
        say(`${member.key}: manual entry without reason or author`);
      }
    }
    if (balance !== member.balanceCents || balance !== balanceOfLines(lines)) {
      say(
        `${member.key}: balance ${member.balanceCents} is not the sum of the lines ${balance}`,
      );
    }
    if (!member.email.endsWith(`@${SHOWCASE_EMAIL_DOMAIN}`))
      say(`${member.key}: e-mail domain`);
  }
  // Every charge of a booking is on the booking's member, at its price.
  for (const booking of plan.bookings) {
    const charges = plan.payments.filter(
      (p) => p.booking === booking && p.kind === 'booking',
    );
    const refunds = plan.payments.filter(
      (p) => p.booking === booking && p.kind === 'booking_refund',
    );
    if (
      charges.length !== 1 ||
      charges[0].amountCents !== booking.priceCents ||
      charges[0].member !== booking.pilot
    ) {
      say(`booking ${name(booking)}: charge`);
    }
    if (
      refunds.length !== (booking.cancelledAt ? 1 : 0) ||
      (refunds[0] && refunds[0].amountCents !== booking.priceCents)
    ) {
      say(`booking ${name(booking)}: refund`);
    }
  }
  // One number per invoice, in the order of their dates, in the showcase
  // series only.
  const numbers = plan.invoices.map((i) => i.number);
  if (new Set(numbers).size !== numbers.length) say('invoice numbers repeat');
  plan.invoices.forEach((invoice, index) => {
    if (
      !invoice.number.startsWith(`${SHOWCASE_INVOICE_PREFIX}-`) ||
      !invoice.number.endsWith(String(index + 1).padStart(5, '0'))
    ) {
      say(`invoice ${invoice.number}: numbering`);
    }
  });
  const emails = plan.members.map((m) => m.email);
  if (new Set(emails).size !== emails.length) say('e-mails repeat');
  return problems;
};
