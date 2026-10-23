import { ADMIN_ACTION } from '../../common/admin-actions/admin-actions';
import { MaintenanceType } from '../../modules/maintenance/entity/maintenance-type.enum';
import { maintenanceWindow } from '../../modules/maintenance/maintenance-rules';
import {
  clubDayStart,
  clubMoment,
} from '../../modules/reservations/booking-rules';
import {
  ANNUAL_VISIT,
  DraftIncident,
  DraftMaintenance,
  INCIDENT_STORIES,
  VISITS,
} from './activity';
import { clubInstant, DAY, HOUR } from './calendar';
import { HISTORY_DAYS } from './build';
import { DraftAdminAction, DraftBooking, DraftMember } from './model';
import { randomFor } from './random';
import { Window } from './schedule';
import { OpenIncident, ShowcaseAircraft, ShowcaseWorld } from './world';

const MINUTE = 60_000;

// What a refresh makes happen to the fleet between the last refresh and
// now: the routine visits the hours and the calendar call for, and the
// incidents pilots report now and then, which the technician deals with.

// A booking is known by its aircraft and start: the same from one refresh
// to the next, whether it was written yet or not.
export const bookingKey = (b: DraftBooking) =>
  `${b.aircraft.key}@${b.start.toISOString()}`;

// ---------- Routine maintenance ----------

type VisitKind = 'annual' | 'hundred' | 'fifty';

// How many days each visit holds the aircraft, and the weekdays it starts
// on (the technician works Tuesday to Thursday).
const VISIT_DAYS: Record<VisitKind, number> = {
  annual: 3,
  hundred: 2,
  fifty: 1,
};
const VISIT_WEEKDAYS: Record<VisitKind, string[]> = {
  annual: ['tuesday'],
  hundred: ['tuesday', 'wednesday'],
  fifty: ['tuesday', 'wednesday', 'thursday'],
};
// The hours after which the 50 h and 100 h visits are done (a little
// ahead, within the tolerance), and how long before its date the annual
// one is.
const FIFTY_DUE_HOURS = 45;
const HUNDRED_DUE_HOURS = 95;
// A visit due by the 50 h count is the 100 h one past this many hours since
// the last 100 h: the two alternate.
const HUNDRED_WITH_FIFTY_HOURS = 70;
const ANNUAL_AHEAD_DAYS = 10;
const ANNUAL_WITH_HOURS_DAYS = 45;
const YEAR = 365 * DAY;
// The share of a booked slot that is flown: the hours of the bookings
// ahead, as the technician counts them.
const FLOWN_SHARE = 0.65;

const kindOf = (visit: DraftMaintenance): VisitKind | null => {
  if (visit.type !== MaintenanceType.INSPECTION) return null;
  if (/annuelle/i.test(visit.description)) return 'annual';
  if (visit.description.includes('100 heures')) return 'hundred';
  if (visit.description.includes('50 heures')) return 'fifty';
  return null;
};

// A maintenance's status at a moment: planned before it starts, in progress
// until its last day is over, then completed.
export const visitStatusAt = (
  visit: Pick<DraftMaintenance, 'start' | 'endDate'>,
  at: Date,
): DraftMaintenance['status'] => {
  if (at.getTime() < visit.start.getTime()) return 'PLANNED';
  if (visit.endDate.getTime() + DAY <= at.getTime()) return 'COMPLETED';
  return 'IN_PROGRESS';
};

interface Usage {
  at: number;
  hours: number;
}

const hoursBetween = (usage: Usage[], from: number, to: number) =>
  usage
    .filter((u) => u.at >= from && u.at < to)
    .reduce((sum, u) => sum + u.hours, 0);

// When each visit was last done on the aircraft. An aircraft whose visit
// is not in the showcase had it shortly before the showcase was made.
const lastVisits = (world: ShowcaseWorld, aircraft: ShowcaseAircraft) => {
  const own = world.visits.filter((v) => v.aircraft.key === aircraft.key);
  const latest = (kinds: VisitKind[]) =>
    own
      .filter((v) => kinds.includes(kindOf(v) as VisitKind))
      .reduce((last, v) => Math.max(last, v.start.getTime()), 0);
  const rng = randomFor(world.seed, 'visits', aircraft.key);
  const created = world.historyStart.getTime() + HISTORY_DAYS * DAY;
  const fiftyBefore = created - rng.int(0, 40) * DAY;
  const hundredBefore = fiftyBefore - (rng.chance(0.5) ? 0 : 45 * DAY);
  // The annual visit falls on the same day each year.
  let annualDue = Date.UTC(new Date(created).getUTCFullYear(), 0, 1);
  annualDue += rng.int(0, 364) * DAY;
  while (annualDue < created) annualDue += YEAR;
  const annual = latest(['annual']);
  return {
    fifty: Math.max(fiftyBefore, latest(['fifty', 'hundred', 'annual'])),
    hundred: Math.max(hundredBefore, latest(['hundred', 'annual'])),
    annualDue: annual > 0 ? annual + YEAR : annualDue,
  };
};

const overlaps = (a: Window, b: Window) =>
  a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();

const draftVisit = (
  world: ShowcaseWorld,
  aircraft: ShowcaseAircraft,
  technician: DraftMember,
  kind: VisitKind,
  day: Date,
): DraftMaintenance => {
  const [type, description, parts, cost] =
    kind === 'annual' ? ANNUAL_VISIT : VISITS[kind === 'hundred' ? 1 : 0];
  const rng = randomFor(world.seed, 'visit', aircraft.key, day.toISOString());
  return {
    aircraft,
    technician,
    start: clubInstant(day, 8 * 60),
    endDate: clubDayStart(day, VISIT_DAYS[kind] - 1),
    status: 'PLANNED',
    type,
    description,
    parts,
    cost: cost + rng.int(-40, 60),
  };
};

const windowOf = (visit: DraftMaintenance): Window =>
  maintenanceWindow({
    start_date: visit.start,
    end_date: visit.endDate,
    status: visit.status,
  })!;

// The routine visits an aircraft needs from the day after the last refresh
// to the end of the bookings ahead, on days nobody has it booked (nor had:
// a booking cancelled since was made before the visit was planned) and the
// technician is free (`workshop`: the periods of the visits of every
// aircraft, which it extends).
const visitsOf = (
  world: ShowcaseWorld,
  aircraft: ShowcaseAircraft,
  technician: DraftMember,
  bookings: DraftBooking[],
  workshop: Window[],
  now: Date,
  horizon: Date,
): DraftMaintenance[] => {
  const own = bookings.filter((b) => b.aircraft.key === aircraft.key);
  const usage: Usage[] = own.flatMap((b) => {
    if (b.cancelledAt) return [];
    if (b.flight && !b.flight.planned) {
      return [{ at: b.flight.departure.getTime(), hours: b.flight.hours }];
    }
    if (b.start.getTime() <= now.getTime()) return [];
    const hours = (b.end.getTime() - b.start.getTime()) / HOUR;
    return [{ at: b.start.getTime(), hours: hours * FLOWN_SHARE }];
  });
  const taken: Window[] = [
    ...own.map((b) => ({ start: b.start, end: b.end })),
    ...world.busy.filter((s) => s.keys.includes(`aircraft:${aircraft.key}`)),
    ...(world.maintenance.get(aircraft.key) ?? []),
  ];
  const last = lastVisits(world, aircraft);
  // The visit the hours call for on a day, if any.
  const byHours = (at: number): VisitKind | null => {
    const sinceHundred = hoursBetween(usage, last.hundred, at);
    if (sinceHundred >= HUNDRED_DUE_HOURS) return 'hundred';
    if (hoursBetween(usage, last.fifty, at) < FIFTY_DUE_HOURS) return null;
    return sinceHundred >= HUNDRED_WITH_FIFTY_HOURS ? 'hundred' : 'fifty';
  };
  // The annual visit when its date comes, or when the hours call for a
  // visit a few weeks before it (it includes the 100 h one).
  const dueOn = (day: Date): VisitKind | null => {
    const at = day.getTime();
    if (at >= last.annualDue - ANNUAL_AHEAD_DAYS * DAY) return 'annual';
    const kind = byHours(at);
    if (kind && at >= last.annualDue - ANNUAL_WITH_HOURS_DAYS * DAY) {
      return 'annual';
    }
    return kind;
  };

  const visits: DraftMaintenance[] = [];
  for (
    let day = clubDayStart(world.since, 1);
    day.getTime() <= horizon.getTime();
    day = clubDayStart(day, 1)
  ) {
    const kind = dueOn(day);
    const weekday = clubMoment(clubInstant(day, 12 * 60)).weekday;
    if (!kind || !VISIT_WEEKDAYS[kind].includes(weekday)) continue;
    const visit = draftVisit(world, aircraft, technician, kind, day);
    const window = windowOf(visit);
    if ([...taken, ...workshop].some((t) => overlaps(t, window))) continue;
    visits.push(visit);
    taken.push(window);
    workshop.push(window);
    last.fifty = visit.start.getTime();
    if (kind !== 'fifty') last.hundred = visit.start.getTime();
    if (kind === 'annual') last.annualDue = visit.start.getTime() + YEAR;
    day = visit.endDate;
  }
  return visits;
};

// The routine visits of the fleet (a grounded aircraft aside), with their
// status at `now`, around `bookings` (cancelled ones included). Their
// periods join the aircraft's maintenance periods.
export const planVisits = (
  world: ShowcaseWorld,
  bookings: DraftBooking[],
  now: Date,
  horizon: Date,
): DraftMaintenance[] => {
  const technician = world.members.find((m) => m.kind === 'technician');
  if (!technician) return [];
  const workshop = world.visits.map(windowOf);
  const visits = world.fleet
    .filter((a) => !a.grounded)
    .flatMap((aircraft) =>
      visitsOf(world, aircraft, technician, bookings, workshop, now, horizon),
    );
  for (const visit of visits) {
    visit.status = visitStatusAt(visit, now);
    world.maintenance.set(visit.aircraft.key, [
      ...(world.maintenance.get(visit.aircraft.key) ?? []),
      windowOf(visit),
    ]);
  }
  return visits.sort((a, b) => a.start.getTime() - b.start.getTime());
};

// ---------- Incidents ----------

// The chance a flight has an incident: about the history of `create` (five
// small ones over six months, some 500 flights).
export const INCIDENT_CHANCE = 0.01;

const STEPS = ['Ouvert', 'En cours', 'Résolu'] as const;
type IncidentStatus = (typeof STEPS)[number];

// When the technician takes an incident up and resolves it, in working
// hours: most within a week, some after weeks (a part to order).
export const incidentTimeline = (
  seed: number,
  aircraftKey: string,
  date: Date,
): { takenAt: Date; resolvedAt: Date } => {
  const rng = randomFor(seed, 'incident-life', aircraftKey, date.toISOString());
  const sameDay = rng.int(9, 17) * HOUR;
  const nextDay = rng.int(9, 12) * HOUR;
  const days = rng.chance(0.3) ? rng.int(10, 40) : rng.int(1, 8);
  const resolvedHour = rng.int(9, 17) * HOUR;
  let takenAt = new Date(clubDayStart(date).getTime() + sameDay);
  if (takenAt.getTime() <= date.getTime() + HOUR) {
    takenAt = new Date(clubDayStart(date, 1).getTime() + nextDay);
  }
  return {
    takenAt,
    resolvedAt: new Date(clubDayStart(takenAt, days).getTime() + resolvedHour),
  };
};

const statusAt = (
  timeline: { takenAt: Date; resolvedAt: Date },
  at: Date,
): IncidentStatus => {
  if (at.getTime() < timeline.takenAt.getTime()) return 'Ouvert';
  if (at.getTime() < timeline.resolvedAt.getTime()) return 'En cours';
  return 'Résolu';
};

// The technician's steps from one status to another, in the trace, dated
// after the last refresh.
const statusActions = (
  technician: DraftMember,
  targetId: () => string,
  from: IncidentStatus,
  to: IncidentStatus,
  timeline: { takenAt: Date; resolvedAt: Date },
  since: Date,
): DraftAdminAction[] => {
  const actions: DraftAdminAction[] = [];
  for (let step = STEPS.indexOf(from); step < STEPS.indexOf(to); step++) {
    const before = STEPS[step];
    const after = STEPS[step + 1];
    const at = after === 'En cours' ? timeline.takenAt : timeline.resolvedAt;
    actions.push({
      actor: technician,
      at: new Date(Math.max(at.getTime(), since.getTime() + MINUTE)),
      action: ADMIN_ACTION.INCIDENT_STATUS_CHANGED,
      targetType: 'incident',
      targetId,
      targetLabel: null,
      summary: () => ({ from: before, to: after }),
    });
  }
  return actions;
};

export interface IncidentChange {
  incident: OpenIncident;
  status: IncidentStatus;
  resolvedAt: Date | null;
  resolutionNote: string | null;
}

export interface IncidentPlan {
  incidents: DraftIncident[];
  changes: IncidentChange[];
  adminActions: DraftAdminAction[];
}

// New incidents on the flights flown since the last refresh, and the open
// ones taken up or resolved since. A grounded aircraft's are left to the
// office.
export const planIncidentsSince = (
  world: ShowcaseWorld,
  flown: DraftBooking[],
  now: Date,
): IncidentPlan => {
  const plan: IncidentPlan = { incidents: [], changes: [], adminActions: [] };
  const technician = world.members.find((m) => m.kind === 'technician');
  if (!technician) return plan;
  const grounded = (aircraft: { key: string }) =>
    world.fleet.some((a) => a.key === aircraft.key && a.grounded);

  for (const booking of flown) {
    const flight = booking.flight!;
    if (grounded(booking.aircraft)) continue;
    const rng = randomFor(world.seed, 'incident', bookingKey(booking));
    if (!rng.chance(INCIDENT_CHANCE)) continue;
    const story = rng.pick(INCIDENT_STORIES);
    const timeline = incidentTimeline(
      world.seed,
      booking.aircraft.key,
      flight.arrival,
    );
    const status = statusAt(timeline, now);
    const resolved = status === 'Résolu';
    const incident: DraftIncident = {
      ...story,
      aircraft: booking.aircraft,
      booking,
      author: booking.pilot,
      date: flight.arrival,
      status,
      resolutionNote: resolved ? story.resolutionNote : null,
      resolvedAt: resolved ? timeline.resolvedAt : null,
      resolvedBy: resolved ? technician : null,
    };
    plan.incidents.push(incident);
    plan.adminActions.push(
      ...statusActions(
        technician,
        () => String(incident.id),
        'Ouvert',
        status,
        timeline,
        world.since,
      ),
    );
  }

  for (const incident of world.openIncidents) {
    if (grounded(incident.aircraft)) continue;
    const timeline = incidentTimeline(
      world.seed,
      incident.aircraft.key,
      incident.date,
    );
    const status = statusAt(timeline, now);
    if (STEPS.indexOf(status) <= STEPS.indexOf(incident.status)) continue;
    const resolved = status === 'Résolu';
    plan.changes.push({
      incident,
      status,
      resolvedAt: resolved
        ? new Date(
            Math.max(
              timeline.resolvedAt.getTime(),
              world.since.getTime() + MINUTE,
            ),
          )
        : null,
      resolutionNote: resolved
        ? (INCIDENT_STORIES.find((s) => s.description === incident.description)
            ?.resolutionNote ??
          'Contrôle fait par le technicien, avion remis en service.')
        : null,
    });
    plan.adminActions.push(
      ...statusActions(
        technician,
        () => String(incident.id),
        incident.status,
        status,
        timeline,
        world.since,
      ),
    );
  }
  return plan;
};
