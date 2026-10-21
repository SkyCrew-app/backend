import { EntityManager } from 'typeorm';
import { Administration } from '../../modules/administration/entity/admin.entity';
import { MaintenanceType } from '../../modules/maintenance/entity/maintenance-type.enum';
import { maintenanceWindow } from '../../modules/maintenance/maintenance-rules';
import { FlightCategory } from '../../modules/reservations/entity/reservations.entity';
import { toCents } from '../../modules/payments/money';
import { DAY } from './calendar';
import { buildFleet, FleetAircraft } from './fleet';
import { HISTORY_DAYS, ShowcaseSettings } from './build';
import { DraftMaintenance } from './activity';
import { DESTINATIONS, LESSONS } from './content';
import { DraftBooking, DraftCourse, DraftMember, MemberKind } from './model';
import { Window } from './schedule';
import { ChecklistsByModel } from './writer';

const MINUTE = 60_000;

// The showcase as it stands in the database, read back into the drafts the
// generator works with, for a refresh. Rows written by others (a booking
// made during a presentation...) are kept apart: they are respected, never
// changed.

export type ShowcaseAircraft = FleetAircraft & {
  id: number;
  totalHours: number;
  grounded: boolean;
};

// A booking or a course of someone else that keeps an aircraft or a member
// of the showcase busy.
export interface BusySpan {
  keys: string[];
  start: Date;
  end: Date;
}

export interface ShowcaseWorld {
  seed: number;
  // When the showcase was last brought up to date.
  since: Date;
  historyStart: Date;
  settings: ShowcaseSettings;
  instruction: boolean;
  members: DraftMember[];
  fleet: ShowcaseAircraft[];
  // Every maintenance of the showcase's aircraft, as periods.
  maintenance: Map<string, Window[]>;
  // The showcase's maintenances still in progress.
  inProgress: DraftMaintenance[];
  // The showcase's bookings (confirmed), with their flight and course.
  bookings: DraftBooking[];
  // Bookings someone else has flown or planned a flight on: left alone.
  untouchable: Set<DraftBooking>;
  courses: DraftCourse[];
  busy: BusySpan[];
  invoiceLastNumber: number;
  // "category|sub-category|month" of the club expenses already written.
  expenseKeys: Set<string>;
  articles: { id: number; title: string }[];
  checklists: ChecklistsByModel;
  treasurer: DraftMember;
}

export const expenseKey = (
  category: string,
  sub: string | null,
  date: Date,
): string => `${category}|${sub ?? ''}|${date.toISOString().slice(0, 7)}`;

// The lesson a course is: from its booking's purpose ("Leçon 3 — ..."), else
// from its competencies.
export const lessonOf = (
  purpose: string | null | undefined,
  competencyNames: string[],
): number | null => {
  const match = /^Leçon (\d+) —/.exec(purpose ?? '');
  if (match) {
    const index = Number(match[1]) - 1;
    if (index >= 0 && index < LESSONS.length) return index;
  }
  const byName = (names: string[]) =>
    [...names].sort((a, b) => a.localeCompare(b)).join('|');
  const key = byName(competencyNames);
  const index = LESSONS.findIndex(
    (l) => byName(l.competencies.map(([name]) => name)) === key,
  );
  return index >= 0 ? index : null;
};

// The destination of a cross-country booking, from its purpose
// ("Navigation LFOX – LFAT (Le Touquet)").
export const destinationOf = (purpose: string | null | undefined) => {
  const match = /– ([A-Z]{4}) \(/.exec(purpose ?? '');
  return match && DESTINATIONS.some((d) => d.icao === match[1])
    ? match[1]
    : null;
};

const KIND_OF_ROLE: Record<string, MemberKind> = {
  Administrateur: 'office',
  Technicien: 'technician',
  Instructeur: 'instructor',
};

const date = (value: unknown): Date => new Date(value as string);
const dateOrNull = (value: unknown): Date | null =>
  value == null ? null : new Date(value as string);

interface Ids {
  of(entity: string): number[];
  has(entity: string, id: unknown): boolean;
}

const showcaseIds = async (manager: EntityManager): Promise<Ids> => {
  const rows: { entity: string; row_id: string }[] = await manager.query(
    `SELECT "entity", "row_id" FROM "showcase_items"`,
  );
  const map = new Map<string, Set<number>>();
  for (const row of rows) {
    const set = map.get(row.entity) ?? new Set<number>();
    set.add(Number(row.row_id));
    map.set(row.entity, set);
  }
  return {
    of: (entity) => [...(map.get(entity) ?? [])],
    has: (entity, id) => map.get(entity)?.has(Number(id)) ?? false,
  };
};

const loadMembers = async (
  manager: EntityManager,
  ids: Ids,
  since: Date,
): Promise<DraftMember[]> => {
  const users: Record<string, unknown>[] = await manager.query(
    `SELECT u."id", u."first_name", u."last_name", u."email", u."password",
            u."total_flight_hours", u."user_account_balance", r."role_name",
            (SELECT MAX(p."payment_date") FROM "payments" p WHERE p."userId" = u."id") AS "last_line"
       FROM "users" u LEFT JOIN "roles" r ON r."id" = u."roleId"
      WHERE u."id" = ANY($1::int[])
      ORDER BY u."id"`,
    [ids.of('users')],
  );
  const licences: Record<string, unknown>[] = await manager.query(
    `SELECT "id", "userId", "license_type", "license_number", "issue_date", "expiration_date", "status", "is_valid", "expiry_reminder_days"
       FROM "licenses" WHERE "userId" = ANY($1::int[]) ORDER BY "id"`,
    [ids.of('users')],
  );
  const students: { id: number }[] = await manager.query(
    `SELECT DISTINCT "studentId" AS "id" FROM "instruction_courses" WHERE "id" = ANY($1::int[])`,
    [ids.of('instruction_courses')],
  );
  const studentIds = new Set(students.map((s) => Number(s.id)));
  // Members without a presentation account share one password hash.
  const hashes = new Map<string, number>();
  for (const u of users) {
    const hash = String(u.password);
    hashes.set(hash, (hashes.get(hash) ?? 0) + 1);
  }
  const locked = [...hashes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return users.map((u) => {
    const id = Number(u.id);
    const role = String(u.role_name ?? '');
    const kind: MemberKind =
      KIND_OF_ROLE[role] ?? (studentIds.has(id) ? 'student' : 'pilot');
    const hours = Number(u.total_flight_hours ?? 0);
    const lastLine = dateOrNull(u.last_line);
    const member: DraftMember = {
      key: `member-${id}`,
      kind,
      first_name: String(u.first_name),
      last_name: String(u.last_name),
      email: String(u.email),
      phone: '',
      address: '',
      birth: since,
      // Every member of the showcase joined before its last refresh.
      joined: new Date(since.getTime() - HISTORY_DAYS * DAY),
      priorHours: hours,
      experienced: kind === 'instructor' || hours >= 250,
      activity: 1,
      licences: [],
      balanceCents: toCents(Number(u.user_account_balance ?? 0)),
      closedHours: 0,
      bookableFrom: new Date(
        Math.max(since.getTime(), lastLine?.getTime() ?? 0) + MINUTE,
      ),
      id,
    };
    if (String(u.password) !== locked) {
      if (kind === 'student') member.login = 'student';
      else if (kind === 'technician') member.login = 'technician';
      else if (kind === 'instructor') member.login = 'instructor';
      else if (kind === 'pilot') member.login = 'pilot';
    }
    member.licences = licences
      .filter((l) => Number(l.userId) === id)
      .map((l) => ({
        member,
        license_type: String(l.license_type),
        license_number: String(l.license_number),
        issue_date: date(l.issue_date),
        expiration_date: date(l.expiration_date),
        status: l.status === 'expired' ? 'expired' : 'active',
        is_valid: Boolean(l.is_valid),
        reminderDays:
          l.expiry_reminder_days == null
            ? null
            : Number(l.expiry_reminder_days),
        id: Number(l.id),
      }));
    return member;
  });
};

const loadFleet = async (
  manager: EntityManager,
  ids: Ids,
): Promise<ShowcaseAircraft[]> => {
  const rows: Record<string, unknown>[] = await manager.query(
    `SELECT "id", "registration_number", "hourly_cost", "total_flight_hours", "availability_status"
       FROM "aircraft" WHERE "id" = ANY($1::int[]) ORDER BY "id"`,
    [ids.of('aircraft')],
  );
  const known = buildFleet();
  return rows.flatMap((row) => {
    const aircraft = known.find(
      (a) => a.registration === row.registration_number,
    );
    if (!aircraft) return [];
    return [
      {
        ...aircraft,
        hourlyCost: Number(row.hourly_cost ?? aircraft.hourlyCost),
        id: Number(row.id),
        totalHours: Number(row.total_flight_hours ?? 0),
        grounded: row.availability_status === 'UNAVAILABLE',
      },
    ];
  });
};

interface Lookup {
  ids: Ids;
  memberById: Map<number, DraftMember>;
  aircraftById: Map<number, ShowcaseAircraft>;
}

// Every maintenance of the showcase's aircraft as periods, and the
// showcase's own still in progress.
const loadMaintenances = async (manager: EntityManager, lookup: Lookup) => {
  const { ids, memberById, aircraftById } = lookup;
  const fleetIds = [...aircraftById.keys()];
  const maintenanceRows: Record<string, unknown>[] = await manager.query(
    `SELECT "id", "aircraftId", "technicianId", "start_date", "end_date", "status", "maintenance_type", "description", "parts_changed", "maintenance_cost"
       FROM "maintenance" WHERE "aircraftId" = ANY($1::int[]) ORDER BY "id"`,
    [fleetIds],
  );
  const maintenance = new Map<string, Window[]>();
  const inProgress: DraftMaintenance[] = [];
  for (const row of maintenanceRows) {
    const aircraft = aircraftById.get(Number(row.aircraftId))!;
    const status = String(row.status ?? '').toUpperCase();
    if (status !== 'CANCELLED') {
      const window = maintenanceWindow({
        start_date: row.start_date as Date,
        end_date: row.end_date as Date,
        status,
      });
      if (window) {
        maintenance.set(aircraft.key, [
          ...(maintenance.get(aircraft.key) ?? []),
          window,
        ]);
      }
    }
    const technician = memberById.get(Number(row.technicianId));
    if (
      ids.has('maintenance', row.id) &&
      status === 'IN_PROGRESS' &&
      technician
    ) {
      inProgress.push({
        aircraft,
        technician,
        start: date(row.start_date),
        endDate: date(row.end_date),
        status: 'IN_PROGRESS',
        type: row.maintenance_type as MaintenanceType,
        description: String(row.description ?? ''),
        parts: (row.parts_changed as string | null) ?? null,
        cost: Number(row.maintenance_cost ?? 0),
        id: Number(row.id),
      });
    }
  }

  return { maintenance, inProgress };
};

// The busy keys (aircraft, members of the showcase) of someone else's
// booking.
const keysOf = (lookup: Lookup, row: Record<string, unknown>): string[] => {
  const keys: string[] = [];
  const aircraft = lookup.aircraftById.get(Number(row.aircraftId));
  if (aircraft) keys.push(`aircraft:${aircraft.key}`);
  for (const id of [row.userId, row.instructorId]) {
    const member = lookup.memberById.get(Number(id));
    if (member) keys.push(`member:${member.key}`);
  }
  return keys;
};

// The showcase's bookings, and those of others that keep its aircraft or
// members busy.
const loadBookings = async (manager: EntityManager, lookup: Lookup) => {
  const { ids, memberById, aircraftById } = lookup;
  const fleetIds = [...aircraftById.keys()];
  const memberIds = [...memberById.keys()];
  const reservationRows: Record<string, unknown>[] = await manager.query(
    `SELECT "id", "aircraftId", "userId", "instructorId", "reservation_date", "start_time", "end_time", "purpose", "flight_category", "notes", "number_of_passengers", "charged_amount", "status"
       FROM "reservations"
      WHERE ("id" = ANY($1::int[]) OR "aircraftId" = ANY($2::int[]) OR "userId" = ANY($3::int[]) OR "instructorId" = ANY($3::int[]))
        AND "status" <> 'cancelled'
      ORDER BY "start_time", "id"`,
    [ids.of('reservations'), fleetIds, memberIds],
  );
  const bookings: DraftBooking[] = [];
  const bookingById = new Map<number, DraftBooking>();
  const busy: BusySpan[] = [];
  for (const row of reservationRows) {
    const aircraft = aircraftById.get(Number(row.aircraftId));
    const pilot = memberById.get(Number(row.userId));
    if (!ids.has('reservations', row.id) || !aircraft || !pilot) {
      busy.push({
        keys: keysOf(lookup, row),
        start: date(row.start_time),
        end: date(row.end_time),
      });
      continue;
    }
    const purpose = String(row.purpose ?? '');
    const booking: DraftBooking = {
      aircraft,
      pilot,
      instructor:
        row.instructorId == null
          ? null
          : (memberById.get(Number(row.instructorId)) ?? null),
      bookedAt: dateOrNull(row.reservation_date) ?? date(row.start_time),
      start: date(row.start_time),
      end: date(row.end_time),
      category: row.flight_category as FlightCategory,
      purpose,
      notes: (row.notes as string | null) ?? null,
      passengers: Number(row.number_of_passengers ?? 0),
      priceCents: toCents(Number(row.charged_amount ?? 0)),
      destination: destinationOf(purpose),
      cancelledAt: null,
      cancelReason: null,
      cancelledBy: null,
      course: null,
      flight: null,
      id: Number(row.id),
    };
    bookings.push(booking);
    bookingById.set(booking.id!, booking);
  }

  return { bookings, bookingById, busy };
};

// The flights of the showcase's bookings. Returns the bookings someone
// else has recorded or planned a flight on.
const loadFlights = async (
  manager: EntityManager,
  lookup: Lookup,
  bookingById: Map<number, DraftBooking>,
): Promise<Set<DraftBooking>> => {
  const { ids } = lookup;
  const untouchable = new Set<DraftBooking>();
  const flightRows: Record<string, unknown>[] = await manager.query(
    `SELECT "id", "reservationId", "flight_hours", "departure_time", "arrival_time", "origin_icao", "destination_icao", "closed_at", "remarks", "number_of_passengers", "plan_engine"
       FROM "flights" WHERE "reservationId" = ANY($1::int[]) ORDER BY "id"`,
    [[...bookingById.keys()]],
  );
  for (const row of flightRows) {
    const booking = bookingById.get(Number(row.reservationId))!;
    if (!ids.has('flights', row.id) || booking.flight) {
      // A flight someone else recorded or planned: the booking is theirs
      // to close.
      untouchable.add(booking);
      continue;
    }
    const planned = row.plan_engine != null && row.closed_at == null;
    if (planned && !booking.destination) {
      booking.destination = String(row.destination_icao ?? '') || null;
    }
    booking.flight = {
      booking,
      hours: Number(row.flight_hours ?? 0),
      departure: dateOrNull(row.departure_time) ?? booking.start,
      arrival: dateOrNull(row.arrival_time) ?? booking.end,
      origin: String(row.origin_icao ?? ''),
      destination: String(row.destination_icao ?? ''),
      closedAt: dateOrNull(row.closed_at),
      remarks: String(row.remarks ?? ''),
      passengers: Number(row.number_of_passengers ?? 0),
      planned,
      id: Number(row.id),
    };
  }

  return untouchable;
};

// The showcase's courses; those of others keep its instructors busy.
const loadCourses = async (
  manager: EntityManager,
  lookup: Lookup,
  bookingById: Map<number, DraftBooking>,
  busy: BusySpan[],
): Promise<DraftCourse[]> => {
  const { ids, memberById } = lookup;
  const memberIds = [...memberById.keys()];
  const courseRows: Record<string, unknown>[] = await manager.query(
    `SELECT c."id", c."instructorId", c."studentId", c."startTime", c."endTime", c."status", c."feedback", c."rating", c."reservationId",
            COALESCE((SELECT json_agg(json_build_object('name', k."name", 'validated', k."validated") ORDER BY k."id")
                        FROM "course_competencies" k WHERE k."courseId" = c."id"), '[]'::json) AS "competencies"
       FROM "instruction_courses" c
      WHERE c."id" = ANY($1::int[]) OR (c."instructorId" = ANY($2::int[]) AND c."status" IN ('SCHEDULED', 'IN_PROGRESS'))
      ORDER BY c."startTime", c."id"`,
    [ids.of('instruction_courses'), memberIds],
  );
  const courses: DraftCourse[] = [];
  for (const row of courseRows) {
    const instructor = memberById.get(Number(row.instructorId));
    const student = memberById.get(Number(row.studentId));
    if (!ids.has('instruction_courses', row.id) || !instructor || !student) {
      if (row.reservationId == null) {
        busy.push({
          keys: [instructor, student]
            .filter((m): m is DraftMember => !!m)
            .map((m) => `member:${m.key}`),
          start: date(row.startTime),
          end: date(row.endTime),
        });
      }
      continue;
    }
    const competencies = row.competencies as {
      name: string;
      validated: boolean;
    }[];
    const booking =
      row.reservationId == null
        ? null
        : (bookingById.get(Number(row.reservationId)) ?? null);
    const lesson = lessonOf(
      booking?.purpose,
      competencies.map((k) => k.name),
    );
    const course: DraftCourse = {
      instructor,
      student,
      lesson: lesson ?? 0,
      start: date(row.startTime),
      end: date(row.endTime),
      status: row.status as DraftCourse['status'],
      feedback: (row.feedback as string | null) ?? null,
      rating: row.rating == null ? null : Number(row.rating),
      competencies: competencies.map((k) => ({
        name: k.name,
        description: '',
        validated: k.validated,
        validatedAt: null,
      })),
      comments: [],
      booking,
      id: Number(row.id),
    };
    if (booking) booking.course = course;
    student.instructor = instructor;
    courses.push(course);
  }

  return courses;
};

// How often each member flies: their share of the recent bookings.
const rateActivity = (
  members: DraftMember[],
  bookings: DraftBooking[],
  since: Date,
): void => {
  const counts = new Map<DraftMember, number>();
  for (const b of bookings) {
    if (b.start.getTime() > since.getTime() - 120 * DAY && !b.course) {
      counts.set(b.pilot, (counts.get(b.pilot) ?? 0) + 1);
    }
  }
  const most = Math.max(1, ...counts.values());
  for (const member of members) {
    member.activity =
      member.kind === 'technician' || member.kind === 'student'
        ? 0
        : Math.max(
            1,
            Math.min(10, Math.round(((counts.get(member) ?? 0) / most) * 10)),
          );
    if (member.login === 'pilot') member.activity = 10;
  }
};

const loadChecklists = async (
  manager: EntityManager,
  ids: Ids,
): Promise<ChecklistsByModel> => {
  const templates: { id: number; model: string }[] = await manager.query(
    `SELECT "id", "aircraft_model" AS "model" FROM "checklist_templates" WHERE "id" = ANY($1::int[]) ORDER BY "id"`,
    [ids.of('checklist_templates')],
  );
  const checklists: ChecklistsByModel = new Map();
  for (const template of templates) {
    const items: { id: number }[] = await manager.query(
      `SELECT "id" FROM "checklist_items" WHERE "templateId" = $1 ORDER BY "sort_order", "id"`,
      [template.id],
    );
    checklists.set(template.model, {
      templateId: Number(template.id),
      itemIds: items.map((i) => Number(i.id)),
    });
  }

  return checklists;
};

export const loadWorld = async (
  manager: EntityManager,
  input: {
    seed: number;
    since: Date;
    instruction: boolean;
    invoiceLastNumber: number;
  },
): Promise<ShowcaseWorld> => {
  const { since } = input;
  const ids = await showcaseIds(manager);
  const settings = await manager
    .getRepository(Administration)
    .createQueryBuilder('a')
    .orderBy('a.id', 'ASC')
    .getOne();
  if (!settings) throw new Error('The club settings are missing.');

  const members = await loadMembers(manager, ids, since);
  const fleet = await loadFleet(manager, ids);
  const lookup: Lookup = {
    ids,
    memberById: new Map(members.map((m) => [m.id!, m])),
    aircraftById: new Map(fleet.map((a) => [a.id, a])),
  };
  const { maintenance, inProgress } = await loadMaintenances(manager, lookup);
  const { bookings, bookingById, busy } = await loadBookings(manager, lookup);
  const untouchable = await loadFlights(manager, lookup, bookingById);
  const courses = await loadCourses(manager, lookup, bookingById, busy);
  rateActivity(members, bookings, since);

  const expenseRows: { category: string; sub: string | null; at: Date }[] =
    await manager.query(
      `SELECT "category", "sub_category" AS "sub", "expense_date" AS "at" FROM "expenses" WHERE "id" = ANY($1::int[])`,
      [ids.of('expenses')],
    );
  const articles: { id: number; title: string }[] = (
    await manager.query(
      `SELECT "id", "title" FROM "article" WHERE "id" = ANY($1::int[]) ORDER BY "id"`,
      [ids.of('article')],
    )
  ).map((a: { id: number; title: string }) => ({
    id: Number(a.id),
    title: a.title,
  }));

  const office = members.filter((m) => m.kind === 'office');
  const firstStart = bookings[0]?.start;
  return {
    seed: input.seed,
    since,
    historyStart:
      firstStart && firstStart.getTime() < since.getTime()
        ? new Date(firstStart.getTime() - DAY)
        : new Date(since.getTime() - HISTORY_DAYS * DAY),
    settings: settings as unknown as ShowcaseSettings,
    instruction: input.instruction,
    members,
    fleet,
    maintenance,
    inProgress,
    bookings,
    untouchable,
    courses,
    busy,
    invoiceLastNumber: input.invoiceLastNumber,
    expenseKeys: new Set(
      expenseRows.map((e) => expenseKey(e.category, e.sub, new Date(e.at))),
    ),
    articles,
    checklists: await loadChecklists(manager, ids),
    treasurer: office[1] ?? office[0] ?? members[0],
  };
};
