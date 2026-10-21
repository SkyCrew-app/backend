import { buildShowcase, planProblems } from '../build';
import { balanceOfLines } from '../ledger';
import { deletionOrder, ForeignKey } from '../removal';
import { parseArguments } from '../showcase';
import { clubAccepts } from '../calendar';
import { SHOWCASE_EMAIL_DOMAIN } from '../content';

// The settings row a new installation gets (as in production).
const PRODUCTION_SETTINGS = {
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
const NOW = new Date('2026-10-16T14:00:00Z');

describe('showcase club plan', () => {
  const plan = buildShowcase({
    now: NOW,
    seed: 42,
    settings: PRODUCTION_SETTINGS,
    instruction: true,
  });

  it('holds every rule the API enforces', () => {
    expect(planProblems(plan)).toEqual([]);
  });

  it('is a medium club with history and bookings ahead', () => {
    const kinds = (kind: string) =>
      plan.members.filter((m) => m.kind === kind).length;
    expect([
      kinds('pilot'),
      kinds('student'),
      kinds('instructor'),
      kinds('technician'),
      kinds('office'),
    ]).toEqual([42, 10, 3, 1, 2]);
    expect(plan.fleet).toHaveLength(6);
    expect(
      plan.bookings.filter((b) => b.start > NOW && !b.cancelledAt).length,
    ).toBeGreaterThan(30);
    expect(
      plan.bookings.filter((b) => b.flight?.closedAt).length,
    ).toBeGreaterThan(400);
    expect(
      plan.members
        .filter((m) => m.login)
        .map((m) => m.login)
        .sort(),
    ).toEqual(['instructor', 'pilot', 'student', 'technician']);
    expect(
      plan.members.every((m) => m.email.endsWith(`@${SHOWCASE_EMAIL_DOMAIN}`)),
    ).toBe(true);
  });

  it('never books on a closure day, in the weekly maintenance or outside opening hours', () => {
    for (const b of plan.bookings) {
      expect(clubAccepts(PRODUCTION_SETTINGS, b.start, b.end)).toBe(true);
    }
  });

  it('keeps each balance equal to the sum of the member lines', () => {
    for (const m of plan.members) {
      expect(balanceOfLines(plan.payments.filter((p) => p.member === m))).toBe(
        m.balanceCents,
      );
    }
  });

  it('numbers its invoices in its own series only', () => {
    expect(
      plan.invoices.every(
        (i, n) =>
          i.number.endsWith(String(n + 1).padStart(5, '0')) &&
          i.number.startsWith('DEMO-'),
      ),
    ).toBe(true);
  });

  it('is the same club for the same seed and the same day', () => {
    const again = buildShowcase({
      now: NOW,
      seed: 42,
      settings: PRODUCTION_SETTINGS,
      instruction: true,
    });
    expect(again.bookings.map((b) => b.start.getTime())).toEqual(
      plan.bookings.map((b) => b.start.getTime()),
    );
    expect(again.members.map((m) => m.email)).toEqual(
      plan.members.map((m) => m.email),
    );
  });

  it('adapts to other settings and still holds the rules', () => {
    const other = buildShowcase({
      now: NOW,
      seed: 7,
      settings: {
        ...PRODUCTION_SETTINGS,
        closureDays: ['Lundi', 'Mardi'],
        reservationStartTime: '09:00',
        reservationEndTime: '18:00',
        maintenanceDay: 'Mercredi',
        pilotLicenses: ['PPL', 'LAPL', 'CPL'],
      },
      instruction: true,
    });
    expect(planProblems(other)).toEqual([]);
  });
});

describe('showcase removal order', () => {
  const fk = (
    table: string,
    refTable: string,
    nullable = false,
  ): ForeignKey => ({
    table,
    column: `${refTable}Id`,
    refTable,
    refColumn: 'id',
    nullable,
    onDelete: 'a',
  });

  it('deletes children before their parents and breaks cycles on optional keys', () => {
    const order = deletionOrder(
      ['users', 'reservations', 'flights', 'incidents', 'payments'],
      [
        fk('reservations', 'users'),
        fk('flights', 'reservations', true),
        fk('flights', 'users'),
        fk('incidents', 'flights', true),
        fk('flights', 'incidents', true),
        fk('payments', 'users'),
      ],
    );
    expect(order.indexOf('users')).toBeGreaterThan(
      order.indexOf('reservations'),
    );
    expect(order.indexOf('users')).toBeGreaterThan(order.indexOf('flights'));
    expect(order.indexOf('users')).toBeGreaterThan(order.indexOf('payments'));
  });

  it('refuses a cycle of mandatory keys', () => {
    expect(() =>
      deletionOrder(['a', 'b'], [fk('a', 'b'), fk('b', 'a')]),
    ).toThrow('circular');
  });
});

describe('showcase command line', () => {
  it('reads the commands and options', () => {
    expect(parseArguments(['create', '--seed', '12'])).toMatchObject({
      command: 'create',
      seed: 12,
    });
    expect(parseArguments(['remove', '--dry-run'])).toMatchObject({
      command: 'remove',
      dryRun: true,
      withDependents: false,
    });
    expect(parseArguments(['--help']).command).toBe('help');
    expect(() => parseArguments(['create', '--fresh'])).toThrow(
      'Unknown option',
    );
    expect(() => parseArguments([])).toThrow('Unknown or missing command');
  });
});
