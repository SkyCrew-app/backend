import { buildShowcase, FUTURE_DAYS, ShowcasePlan } from '../build';
import { planRefresh, RefreshPlan, refreshProblems } from '../refresh';
import { expenseKey, lessonOf, destinationOf, ShowcaseWorld } from '../world';
import { tripBookings } from '../writer';
import { ARTICLES } from '../library';
import { DAY, HOUR } from '../calendar';
import { LESSONS } from '../content';
import { balanceOfLines } from '../ledger';
import { parseArguments } from '../showcase';
import { DraftBooking } from '../model';
import { randomFor } from '../random';

const SETTINGS = {
  closureDays: ['Dimanche'],
  timeSlotDuration: 30,
  reservationStartTime: '08:00:00',
  reservationEndTime: '20:00:00',
  maintenanceDay: 'Monday',
  maintenanceDuration: 4,
  pilotLicenses: ['PPL', 'CPL', 'ATPL', 'ULM'],
  membershipFee: 250,
  fuelPrice: 2.45,
};
const MINUTE = 60_000;

// The showcase as a refresh reads it back from the database, built from a
// plan as `create` writes it (the ids the database would give).
const worldFromPlan = (plan: ShowcasePlan): ShowcaseWorld => {
  let id = 1;
  const next = () => id++;
  plan.members.forEach((m) => (m.id = next()));
  plan.fleet.forEach((a) => (a.id = next()));
  plan.courses.forEach((c) => (c.id = next()));
  const active = plan.bookings.filter((b) => !b.cancelledAt);
  for (const b of plan.bookings) {
    b.id = next();
    if (b.flight) b.flight.id = next();
  }
  // The flight plans `create` makes on the next trips.
  for (const b of tripBookings(active, plan.now, 6)) {
    b.flight = {
      booking: b,
      hours: 2,
      departure: b.start,
      arrival: b.end,
      origin: 'LFOX',
      destination: b.destination!,
      closedAt: null,
      remarks: '',
      passengers: b.passengers,
      planned: true,
      id: next(),
    };
  }
  const lastLine = new Map<unknown, number>();
  for (const p of plan.payments) {
    lastLine.set(
      p.member,
      Math.max(lastLine.get(p.member) ?? 0, p.date.getTime()),
    );
  }
  for (const m of plan.members) {
    m.bookableFrom = new Date(
      Math.max(plan.now.getTime(), lastLine.get(m) ?? 0) + MINUTE,
    );
  }
  const office = plan.members.filter((m) => m.kind === 'office');
  return {
    seed: plan.seed,
    since: plan.now,
    historyStart: plan.historyStart,
    settings: plan.settings,
    instruction: plan.instruction,
    members: plan.members,
    fleet: plan.fleet as ShowcaseWorld['fleet'],
    maintenance: plan.maintenance,
    visits: plan.maintenances,
    openIncidents: plan.incidents
      .filter((x) => x.status !== 'Résolu')
      .map((x) => ({
        id: next(),
        aircraft: x.aircraft as ShowcaseWorld['fleet'][number],
        date: x.date,
        description: x.description,
        status: x.status as 'Ouvert' | 'En cours',
      })),
    bookings: active,
    untouchable: new Set(),
    courses: plan.courses,
    busy: [],
    invoiceLastNumber: plan.invoiceLastNumber,
    expenseKeys: new Set(
      plan.expenses.map((e) => expenseKey(e.category, e.sub, e.date)),
    ),
    articles: ARTICLES.map((a) => ({ id: next(), title: a.title })),
    checklists: new Map(),
    treasurer: office[1] ?? office[0],
    newcomers: 0,
    lockedHash: null,
    emails: new Set(plan.members.map((m) => m.email.toLowerCase())),
  };
};

// What the database holds once a refresh is written, read back.
const applied = (world: ShowcaseWorld, plan: RefreshPlan): ShowcaseWorld => {
  let id = 1_000_000;
  const cancelled = new Set(plan.cancelled);
  for (const b of plan.newBookings) b.id = id++;
  for (const b of plan.flown) {
    if (!b.flight!.id) b.flight!.id = id++;
  }
  for (const c of plan.newCourses) c.id = id++;
  for (const m of plan.newMembers) m.id = id++;
  for (const m of plan.newMaintenances) m.id = id++;
  for (const x of plan.newIncidents) x.id = id++;
  const changed = new Map(plan.incidentChanges.map((c) => [c.incident, c]));
  // The flight plans written on the trips.
  for (const b of plan.trips) {
    b.flight = {
      booking: b,
      hours: 2,
      departure: b.start,
      arrival: b.end,
      origin: 'LFOX',
      destination: b.destination!,
      closedAt: null,
      remarks: '',
      passengers: b.passengers,
      planned: true,
      id: id++,
    };
  }
  const lastLine = new Map<unknown, number>();
  for (const p of plan.payments) {
    lastLine.set(
      p.member,
      Math.max(lastLine.get(p.member) ?? 0, p.date.getTime()),
    );
  }
  for (const m of world.members) {
    m.bookableFrom = new Date(
      Math.max(
        plan.now.getTime(),
        lastLine.get(m) ?? 0,
        m.bookableFrom!.getTime() - MINUTE,
      ) + MINUTE,
    );
  }
  return {
    ...world,
    since: plan.now,
    bookings: [
      ...world.bookings.filter((b) => !cancelled.has(b)),
      ...plan.newBookings.filter((b) => !b.cancelledAt),
    ].sort((a, b) => a.start.getTime() - b.start.getTime()),
    courses: [...world.courses, ...plan.newCourses],
    visits: [...world.visits, ...plan.newMaintenances].sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    ),
    openIncidents: [
      ...world.openIncidents.map((x) => ({
        ...x,
        status: changed.get(x)?.status ?? x.status,
      })),
      ...plan.newIncidents.map((x) => ({
        id: x.id!,
        aircraft: x.aircraft as ShowcaseWorld['fleet'][number],
        date: x.date,
        description: x.description,
        status: x.status,
      })),
    ].filter((x): x is ShowcaseWorld['openIncidents'][number] =>
      ['Ouvert', 'En cours'].includes(x.status),
    ),
    newcomers: world.newcomers + plan.newMembers.length,
    emails: new Set([
      ...world.emails,
      ...plan.newMembers.map((m) => m.email.toLowerCase()),
    ]),
    invoiceLastNumber: plan.invoiceLastNumber,
    expenseKeys: new Set([
      ...world.expenseKeys,
      ...plan.expenses.map((e) => expenseKey(e.category, e.sub, e.date)),
    ]),
  };
};

const CREATED = new Date('2026-10-17T09:30:00Z');
const created = () =>
  worldFromPlan(
    buildShowcase({
      now: CREATED,
      seed: 4242,
      settings: SETTINGS,
      instruction: true,
    }),
  );

const added = (plan: RefreshPlan) =>
  plan.newBookings.length +
  plan.cancelled.length +
  plan.flown.length +
  plan.closed.length +
  plan.newCourses.length +
  plan.changedCourses.length +
  plan.payments.length +
  plan.invoices.length +
  plan.adminActions.length +
  plan.notifications.length +
  plan.expenses.length +
  plan.completedMaintenances.length +
  plan.maintenanceChanges.length +
  plan.newMaintenances.length +
  plan.newIncidents.length +
  plan.incidentChanges.length +
  plan.licenceChanges.length +
  plan.newMembers.length +
  plan.trips.length;

describe('showcase refresh', () => {
  const NOW = new Date('2026-10-27T07:45:00Z');
  const world = created();
  const balancesBefore = new Map(world.members.map((m) => [m, m.balanceCents]));
  const invoicesBefore = world.invoiceLastNumber;
  const plan = planRefresh(world, NOW);

  it('holds every rule the API enforces', () => {
    expect(refreshProblems(world, plan)).toEqual([]);
  });

  it('flies, closes or cancels every booking whose time has passed', () => {
    const due = world.bookings.filter(
      (b) =>
        b.end.getTime() > CREATED.getTime() && b.end.getTime() <= NOW.getTime(),
    );
    expect(due.length).toBeGreaterThan(20);
    for (const b of due) {
      const settled =
        plan.cancelled.includes(b) || (!!b.flight && !b.flight.planned);
      expect(settled).toBe(true);
    }
    expect(plan.flown.length).toBeGreaterThan(20);
    // Most are closed; the hours count for the members and the aircraft.
    const closed = plan.flown.filter((b) => b.flight!.closedAt);
    expect(closed.length).toBeGreaterThan(plan.flown.length / 2);
    const hours = [...plan.aircraftHours.values()].reduce((s, h) => s + h, 0);
    expect(hours).toBeCloseTo(
      [...closed, ...plan.closed].reduce((s, b) => s + b.flight!.hours, 0),
    );
    // A flight plan made ahead is the flight its pilot closes.
    expect(plan.flown.some((b) => b.flight!.id)).toBe(true);
  });

  it('books three weeks ahead of now again', () => {
    const active = [...world.bookings, ...plan.newBookings].filter(
      (b) => !b.cancelledAt && !plan.cancelled.includes(b),
    );
    const lastWeek = active.filter(
      (b) =>
        b.start.getTime() > NOW.getTime() + (FUTURE_DAYS - 7) * DAY &&
        b.start.getTime() <= NOW.getTime() + (FUTURE_DAYS + 1) * DAY,
    );
    expect(lastWeek.length).toBeGreaterThan(10);
    expect(
      active.filter((b) => b.start.getTime() > NOW.getTime()).length,
    ).toBeGreaterThan(40);
    // Students keep their next lessons, the presenter their trips.
    const upcoming = (b: DraftBooking) => b.start.getTime() > NOW.getTime();
    // (but those who have passed the last lesson).
    const finished = (student: unknown) =>
      world.courses.some(
        (c) =>
          c.student === student &&
          c.lesson === LESSONS.length - 1 &&
          c.status === 'COMPLETED' &&
          c.competencies.every((k) => k.validated),
      );
    for (const student of world.members.filter(
      (m) => m.kind === 'student' && !finished(m),
    )) {
      expect(
        active.filter((b) => b.pilot === student && upcoming(b)).length,
      ).toBeGreaterThan(0);
    }
    const presenter = world.members.find((m) => m.login === 'pilot')!;
    expect(
      active.filter(
        (b) =>
          b.pilot === presenter &&
          upcoming(b) &&
          b.category === 'cross_country',
      ).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('charges each new booking and keeps the balances above zero', () => {
    for (const b of plan.newBookings) {
      const charges = plan.payments.filter(
        (p) => p.booking === b && p.kind === 'booking',
      );
      expect(charges).toHaveLength(1);
      expect(charges[0].amountCents).toBe(b.priceCents);
      expect(
        plan.payments.filter((p) => p.booking === b && p.kind !== 'booking'),
      ).toHaveLength(b.cancelledAt ? 1 : 0);
    }
    for (const b of plan.cancelled) {
      expect(
        plan.payments.filter(
          (p) => p.booking === b && p.kind === 'booking_refund',
        ),
      ).toHaveLength(1);
    }
    for (const m of world.members) {
      expect(m.balanceCents).toBeGreaterThanOrEqual(0);
      expect(m.balanceCents - (balancesBefore.get(m) ?? 0)).toBe(
        balanceOfLines(plan.payments.filter((p) => p.member === m)),
      );
    }
  });

  it('numbers its invoices after the last one of the showcase series', () => {
    expect(plan.invoices.length).toBeGreaterThan(0);
    plan.invoices.forEach((invoice, index) => {
      expect(invoice.number).toMatch(/^DEMO-\d{4}-\d{5}$/);
      expect(invoice.number.endsWith(String(invoicesBefore + index + 1))).toBe(
        true,
      );
    });
    expect(plan.invoiceLastNumber).toBe(invoicesBefore + plan.invoices.length);
  });

  it('writes what happened in between, dated in between', () => {
    for (const n of plan.notifications) {
      expect(n.date.getTime()).toBeGreaterThan(CREATED.getTime());
      expect(n.date.getTime()).toBeLessThanOrEqual(NOW.getTime());
    }
    expect(plan.notifications.length).toBeGreaterThan(0);
    // The maintenance in progress is over.
    expect(plan.completedMaintenances).toHaveLength(1);
    expect(plan.expenses.some((e) => e.category === 'Maintenance')).toBe(true);
    // The news keep their place relative to now.
    expect(plan.articles).toHaveLength(ARTICLES.length);
    // Lessons whose time has come have their outcome.
    for (const course of plan.changedCourses) {
      if (course.booking && course.booking.end.getTime() <= NOW.getTime()) {
        expect(['COMPLETED', 'CANCELED']).toContain(course.status);
      }
    }
  });

  it('adds nothing when run again', () => {
    const again = planRefresh(
      applied(world, plan),
      new Date(NOW.getTime() + 3 * MINUTE),
    );
    expect(added(again)).toBe(0);
  });

  it('takes the same decisions from the same seed and date', () => {
    const other = planRefresh(created(), NOW);
    expect(other.newBookings.map((b) => b.start.getTime())).toEqual(
      plan.newBookings.map((b) => b.start.getTime()),
    );
    expect(other.payments.map((p) => p.amountCents)).toEqual(
      plan.payments.map((p) => p.amountCents),
    );
  });

  it('catches up on a long absence, the yearly fee included', () => {
    const early = worldFromPlan(
      buildShowcase({
        now: new Date('2026-08-10T10:00:00Z'),
        seed: 99,
        settings: SETTINGS,
        instruction: true,
      }),
    );
    const late = planRefresh(early, new Date('2026-10-02T16:00:00Z'));
    expect(refreshProblems(early, late)).toEqual([]);
    expect(
      late.payments.filter(
        (p) => p.kind === 'manual_debit' && p.reason?.startsWith('Cotisation'),
      ),
    ).toHaveLength(early.members.length);
    // The weeks never planned are flown in full.
    expect(late.flown.length).toBeGreaterThan(150);
    const then = applied(early, late);
    expect(added(planRefresh(then, new Date('2026-10-02T16:05:00Z')))).toBe(0);
  });

  it('writes each monthly expense once, whatever the days of the refreshes', () => {
    const first = created();
    const a = planRefresh(first, new Date('2026-11-04T08:00:00Z'));
    const b = planRefresh(applied(first, a), new Date('2026-11-20T08:00:00Z'));
    const november = [...a.expenses, ...b.expenses].filter(
      (e) =>
        e.category !== 'Maintenance' &&
        e.date.toISOString().startsWith('2026-11'),
    );
    for (const sub of ['100LL', 'Location hangar', 'Flotte', 'Électricité']) {
      expect(november.filter((e) => e.sub === sub)).toHaveLength(1);
    }
  });

  it('respects the bookings of others', () => {
    const others = created();
    const aircraft = others.fleet.find((a) => !a.grounded)!;
    // Someone booked that aircraft over the days the showcase had not
    // planned yet.
    const from = CREATED.getTime() + (FUTURE_DAYS + 1) * DAY;
    others.busy.push({
      keys: [`aircraft:${aircraft.key}`],
      start: new Date(from),
      end: new Date(from + 15 * DAY),
    });
    const refresh = planRefresh(others, NOW);
    expect(refreshProblems(others, refresh)).toEqual([]);
    expect(
      refresh.newBookings.filter(
        (b) => b.aircraft.key === aircraft.key && b.end.getTime() > from,
      ),
    ).toEqual([]);
  });
});

describe('showcase life over months', () => {
  // Refreshed every week for five months, as before each presentation.
  const world0 = created();
  const presenter = world0.members.find((m) => m.login === 'pilot')!;
  // What each refresh would refuse, and the licences the office's alerts
  // show (expired, or expiring within 60 days), as they were then.
  const steps: { plan: RefreshPlan; problems: string[]; alerts: number }[] = [];
  let world = world0;
  for (let week = 1; week <= 22; week++) {
    const at = new Date(CREATED.getTime() + week * 7 * DAY - 2 * HOUR);
    const plan = planRefresh(world, at);
    const alerts = world.members
      .flatMap((m) => m.licences)
      .filter(
        (l) =>
          l.status === 'expired' ||
          l.expiration_date.getTime() < at.getTime() + 60 * DAY,
      ).length;
    steps.push({ plan, problems: refreshProblems(world, plan), alerts });
    world = applied(world, plan);
  }
  const plans = steps.map((s) => s.plan);
  const all = <T>(pick: (plan: RefreshPlan) => T[]) => plans.flatMap(pick);

  it('holds every rule at every refresh', () => {
    for (const { problems } of steps) expect(problems).toEqual([]);
  });

  it('plans the 50 h, 100 h and annual visits, around the bookings', () => {
    const visits = all((p) => p.newMaintenances);
    const named = (text: string) =>
      visits.filter((v) => v.description.includes(text)).length;
    expect(named('Visite 50 heures')).toBeGreaterThan(3);
    expect(named('Visite 100 heures')).toBeGreaterThan(1);
    expect(named('Visite annuelle')).toBeGreaterThan(0);
    // Tuesday to Thursday, from 08:00.
    for (const v of visits) {
      expect([2, 3, 4]).toContain(
        new Date(v.start.getTime() + 2 * HOUR).getUTCDay(),
      );
    }
    // Planned ahead, then started, then completed with its expense.
    const changes = all((p) => p.maintenanceChanges);
    expect(changes.some((m) => m.status === 'COMPLETED')).toBe(true);
    expect(
      plans.some((p) =>
        p.newMaintenances.some((v) => v.start.getTime() > p.now.getTime()),
      ),
    ).toBe(true);
    for (const v of visits) {
      if (v.endDate.getTime() + DAY > world.since.getTime()) continue;
      expect(v.status).toBe('COMPLETED');
      expect(
        all((p) => p.expenses).filter(
          (e) =>
            e.category === 'Maintenance' &&
            e.aircraft === v.aircraft &&
            e.date.getTime() === v.endDate.getTime() + 14 * HOUR,
        ),
      ).toHaveLength(1);
    }
    // No booking ever over a visit (the bookings of each refresh after it
    // was planned included).
    const active = world.bookings;
    for (const v of world.visits) {
      const end = v.endDate.getTime() + DAY;
      expect(
        active.filter(
          (b) =>
            b.aircraft.key === v.aircraft.key &&
            b.start.getTime() < end &&
            v.start.getTime() < b.end.getTime(),
        ),
      ).toEqual([]);
    }
  });

  it('has an incident now and then, dealt with over the next refreshes', () => {
    const incidents = all((p) => p.newIncidents);
    const flown = all((p) => p.flown).length;
    expect(incidents.length).toBeGreaterThan(0);
    expect(incidents.length).toBeLessThan(flown * 0.03);
    for (const x of incidents) {
      expect(x.booking.flight?.arrival).toEqual(x.date);
      expect(x.author).toBe(x.booking.pilot);
    }
    const resolved = all((p) => p.incidentChanges).filter(
      (c) => c.status === 'Résolu',
    );
    expect(resolved.length).toBeGreaterThan(0);
    for (const c of resolved) {
      expect(c.resolutionNote).toBeTruthy();
      expect(c.resolvedAt).not.toBeNull();
    }
  });

  it('renews the licences before they expire, a few after they lapsed', () => {
    const changes = all((p) => p.licenceChanges);
    const renewed = changes.filter((c) => c.renewed);
    expect(renewed.length).toBeGreaterThan(5);
    for (const c of renewed) {
      expect(c.licence.status).toBe('active');
      expect(c.licence.expiration_date.getTime()).toBeGreaterThan(
        c.licence.renewedAt!.getTime() + 300 * DAY,
      );
    }
    // The presentation pilot's never lapses.
    expect(
      changes.filter((c) => c.licence.member === presenter && c.lapsed),
    ).toEqual([]);
    // The office's alerts always have a licence to show.
    for (const { alerts } of steps) expect(alerts).toBeGreaterThan(0);
    // A few lapse.
    expect(changes.filter((c) => c.lapsed).length).toBeGreaterThan(0);
  });

  it('enrols new students as others finish', () => {
    const newcomers = all((p) => p.newMembers);
    expect(newcomers.length).toBeGreaterThan(0);
    for (const m of newcomers) {
      expect(m.kind).toBe('student');
      expect(m.licences).toEqual([]);
      expect(m.login).toBeUndefined();
      expect(m.email.endsWith('@exemple-aeroclub.invalid')).toBe(true);
      expect(m.instructor?.kind).toBe('instructor');
      const plan = plans.find((p) => p.newMembers.includes(m))!;
      // An account opened on joining, and lessons booked.
      expect(
        plan.payments.some(
          (p) =>
            p.member === m &&
            p.kind !== 'booking' &&
            p.date.getTime() <= m.joined.getTime() + HOUR,
        ),
      ).toBe(true);
      expect(world.courses.some((c) => c.student === m)).toBe(true);
    }
    const emails = world.members.map((m) => m.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('adds nothing when run again', () => {
    expect(
      added(planRefresh(world, new Date(world.since.getTime() + 3 * MINUTE))),
    ).toBe(0);
  });
});

describe('showcase read back', () => {
  it('knows a lesson by its purpose or its competencies', () => {
    expect(lessonOf(`Leçon 3 — ${LESSONS[2].title}`, [])).toBe(2);
    expect(
      lessonOf(null, LESSONS[4].competencies.map(([name]) => name).reverse()),
    ).toBe(4);
    expect(lessonOf('Vol local', ['?'])).toBeNull();
  });

  it('knows the destination of a trip', () => {
    expect(destinationOf('Navigation LFOX – LFAT (Le Touquet)')).toBe('LFAT');
    expect(destinationOf('Vol local')).toBeNull();
  });

  it('draws the same from the same parts', () => {
    expect(randomFor(1, 'day', 'x').next()).toBe(
      randomFor(1, 'day', 'x').next(),
    );
    expect(randomFor(1, 'day', 'x').next()).not.toBe(
      randomFor(2, 'day', 'x').next(),
    );
  });

  it('reads the refresh command', () => {
    expect(
      parseArguments(['refresh', '--dry-run', '--now', '2026-11-02T08:00:00Z']),
    ).toMatchObject({
      command: 'refresh',
      dryRun: true,
      now: new Date('2026-11-02T08:00:00Z'),
    });
    expect(() => parseArguments(['refresh', '--now', 'tomorrow'])).toThrow(
      '--now',
    );
  });
});
