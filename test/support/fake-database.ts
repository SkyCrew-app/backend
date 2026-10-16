import { FindOperator } from 'typeorm';
import { Aircraft } from '../../src/modules/aircraft/entity/aircraft.entity';
import { InstructionCourse } from '../../src/modules/instruction-courses/entity/instruction-courses.entity';
import { Invoice } from '../../src/modules/invoices/entity/invoices.entity';
import { Maintenance } from '../../src/modules/maintenance/entity/maintenance.entity';
import { Payment } from '../../src/modules/payments/entity/payments.entity';
import { Reservation } from '../../src/modules/reservations/entity/reservations.entity';
import { User } from '../../src/modules/users/entity/users.entity';

// An in-memory stand-in for the database, for the services that move money.
//
// What it reproduces: transactions that roll everything back when they fail,
// the two SQL statements the services write by hand (row locks and the
// atomic balance update), numeric(10,2) columns, the foreign key from
// checklists to bookings and, on request, the exclusion constraint.
//
// What it does not: Postgres row locks. Transactions here run one after the
// other, which is what the locks taken by the services give in Postgres for
// operations on the same aircraft, member or booking. `locks` records the
// locks asked for, so tests can check they are taken.

type Row = Record<string, any>;
type EntityClass = new () => unknown;

const money = (value: unknown) => Math.round(Number(value) * 100) / 100;

const MONEY_COLUMNS = [
  'amount',
  'amount_paid',
  'balance_due',
  'charged_amount',
  'refunded_amount',
  'user_account_balance',
];

const databaseError = (code: string, message: string) =>
  Object.assign(new Error(message), { code, driverError: { code } });

const sameValue = (actual: unknown, expected: unknown) => {
  if (actual instanceof Date || expected instanceof Date) {
    return (
      new Date(actual as Date).getTime() ===
      new Date(expected as Date).getTime()
    );
  }
  return actual === expected || String(actual) === String(expected);
};

const order = (value: unknown) =>
  value instanceof Date ? value.getTime() : (value as number);

const matches = (actual: unknown, expected: unknown): boolean => {
  // A list of conditions is a choice between them, as in TypeORM.
  if (Array.isArray(expected)) {
    return expected.some((condition) => matches(actual, condition));
  }
  if (expected instanceof FindOperator) {
    const value = expected.value as any;
    switch (expected.type) {
      case 'lessThan':
        return order(actual) < order(value);
      case 'moreThan':
        return order(actual) > order(value);
      case 'not':
        return !matches(actual, value);
      case 'in':
        return (value as unknown[]).some((item) => sameValue(actual, item));
      case 'between':
        return (
          order(actual) >= order(value[0]) && order(actual) <= order(value[1])
        );
      default:
        throw new Error(`Fake database: operator ${expected.type}`);
    }
  }
  if (
    expected !== null &&
    typeof expected === 'object' &&
    !(expected instanceof Date)
  ) {
    return Object.entries(expected).every(([key, value]) =>
      matches((actual as Row)?.[key], value),
    );
  }
  return sameValue(actual, expected);
};

export class FakeDatabase {
  private tables = new Map<EntityClass, Row[]>();
  private sequences = new Map<EntityClass, number>();
  private queue: Promise<unknown> = Promise.resolve();

  // Bookings a checklist points to: [{ id, reservationId }].
  checklistSubmissions: { id: number; reservationId: number | null }[] = [];
  flights: {
    id: number;
    reservationId: number;
    closed_at?: Date | null;
    departure_time?: Date | null;
    arrival_time?: Date | null;
  }[] = [];
  // Last invoice number given, per year.
  invoiceSequences = new Map<number, number>();
  // Row locks asked for, in order: "aircraft:1", "users:2"…
  locks: string[] = [];
  // Every hand-written SQL statement received.
  statements: string[] = [];
  // Refuse overlapping bookings of an aircraft, as the migration's
  // exclusion constraint does.
  enforceSlotExclusion = false;
  // Make the next write on this entity fail, once.
  failNextSaveOf: EntityClass | null = null;
  failNextDeleteOf: EntityClass | null = null;

  readonly manager: any = {
    transaction: (work: (manager: unknown) => Promise<unknown>) =>
      this.transaction(work),
    query: async (sql: string, parameters: unknown[] = []) =>
      this.query(sql, parameters),
    create: (_entity: EntityClass, row: Row) => ({ ...row }),
    findOne: async (entity: EntityClass, options: Row = {}) =>
      this.rows(entity)
        .filter((row) => matches(this.hydrate(entity, row), options.where))
        .map((row) => this.hydrate(entity, row))[0] ?? null,
    find: async (entity: EntityClass, options: Row = {}) =>
      this.rows(entity)
        .map((row) => this.hydrate(entity, row))
        .filter((row) => matches(row, options.where ?? {})),
    save: async (entity: EntityClass, row: Row) => this.save(entity, row),
    update: async (entity: EntityClass, criteria: Row, changes: Row) => {
      const targets = this.rows(entity).filter((row) => matches(row, criteria));
      targets.forEach((row) => Object.assign(row, this.normalise(changes)));
      return { affected: targets.length };
    },
    delete: async (entity: EntityClass, criteria: Row) =>
      this.delete(entity, criteria),
  };

  rows(entity: EntityClass): Row[] {
    if (!this.tables.has(entity)) this.tables.set(entity, []);
    return this.tables.get(entity);
  }

  insert<T extends Row>(entity: EntityClass, row: T): T & { id: number } {
    const id = row.id ?? (this.sequences.get(entity) ?? 0) + 1;
    this.sequences.set(entity, Math.max(id, this.sequences.get(entity) ?? 0));
    const stored = { ...this.normalise(row), id };
    this.rows(entity).push(stored);
    return stored as T & { id: number };
  }

  // What a service receives through @InjectRepository.
  repository(entity: EntityClass): any {
    const manager = this.manager;
    return {
      manager,
      create: (row: Row) => manager.create(entity, row),
      save: (row: Row) => manager.save(entity, row),
      findOne: (options: Row) => manager.findOne(entity, options),
      find: (options: Row) => manager.find(entity, options),
      update: (criteria: Row, changes: Row) =>
        manager.update(entity, criteria, changes),
      delete: (criteria: Row) => manager.delete(entity, criteria),
    };
  }

  balanceOf(userId: number): number {
    return Number(
      this.rows(User).find((user) => user.id === userId).user_account_balance,
    );
  }

  private normalise(row: Row): Row {
    const stored: Row = { ...row };
    for (const column of MONEY_COLUMNS) {
      if (stored[column] !== undefined && stored[column] !== null) {
        stored[column] = money(stored[column]);
      }
    }
    // Relations are kept as references, as foreign keys are.
    for (const relation of [
      'user',
      'aircraft',
      'invoice',
      'student',
      'instructor',
      'reservation',
    ]) {
      if (stored[relation] && typeof stored[relation] === 'object') {
        stored[relation] = { id: stored[relation].id };
      }
    }
    delete stored.flights;
    return stored;
  }

  private hydrate(entity: EntityClass, row: Row): Row {
    const loaded: Row = { ...row };
    const related = (table: EntityClass, reference: Row | undefined) =>
      reference
        ? {
            ...(this.rows(table).find((item) => item.id === reference.id) ??
              reference),
          }
        : reference;
    if (entity === Reservation) {
      loaded.aircraft = related(Aircraft, row.aircraft);
      loaded.user = related(User, row.user);
      loaded.instructor = related(User, row.instructor) ?? null;
      loaded.flights = this.flights.filter(
        (flight) => flight.reservationId === row.id,
      );
    }
    if (entity === InstructionCourse) {
      loaded.instructor = related(User, row.instructor);
      loaded.student = related(User, row.student);
      loaded.reservation = row.reservation
        ? (this.rows(Reservation).find(
            (item) => item.id === row.reservation.id,
          ) ?? null)
        : null;
      if (loaded.reservation) loaded.reservation = { ...loaded.reservation };
    }
    if (entity === Payment || entity === Invoice) {
      loaded.user = related(User, row.user);
    }
    if (entity === Payment) {
      loaded.invoice = related(Invoice, row.invoice);
    }
    return loaded;
  }

  private async save(entity: EntityClass, row: Row): Promise<Row> {
    if (this.failNextSaveOf === entity) {
      this.failNextSaveOf = null;
      throw new Error('Fake database: write failed');
    }
    if (entity === Reservation) {
      if (!(new Date(row.end_time) > new Date(row.start_time))) {
        throw databaseError('23514', 'check constraint');
      }
      if (
        this.enforceSlotExclusion &&
        this.rows(Reservation).some(
          (other) =>
            other.id !== row.id &&
            other.aircraft?.id === row.aircraft?.id &&
            new Date(other.start_time) < new Date(row.end_time) &&
            new Date(other.end_time) > new Date(row.start_time),
        )
      ) {
        throw databaseError('23P01', 'exclusion constraint');
      }
    }
    const existing =
      row.id != null && this.rows(entity).find((item) => item.id === row.id);
    if (existing) {
      Object.assign(existing, this.normalise(row));
      return row;
    }
    row.id = this.insert(entity, row).id;
    return row;
  }

  private async delete(entity: EntityClass, criteria: Row) {
    if (this.failNextDeleteOf === entity) {
      this.failNextDeleteOf = null;
      throw new Error('Fake database: delete failed');
    }
    const table = this.rows(entity);
    const targets = table.filter((row) => matches(row, criteria));
    for (const target of targets) {
      if (
        entity === Reservation &&
        this.checklistSubmissions.some(
          (submission) => submission.reservationId === target.id,
        )
      ) {
        throw databaseError('23503', 'foreign key checklist_submissions');
      }
      table.splice(table.indexOf(target), 1);
    }
    return { affected: targets.length };
  }

  private async query(sql: string, parameters: unknown[]) {
    this.statements.push(sql);

    const lock =
      /^SELECT "id" FROM "(\w+)" WHERE "id" = \$1 FOR NO KEY UPDATE$/.exec(sql);
    if (lock) {
      const entity = {
        aircraft: Aircraft,
        users: User,
        reservations: Reservation,
        payments: Payment,
      }[lock[1]];
      const found = this.rows(entity).some((row) => row.id === parameters[0]);
      if (found) this.locks.push(`${lock[1]}:${parameters[0]}`);
      return found ? [{ id: parameters[0] }] : [];
    }

    if (
      sql.startsWith(
        'UPDATE "users" SET "user_account_balance" = "user_account_balance" + $1::numeric',
      )
    ) {
      const [amount, userId] = parameters;
      const user = this.rows(User).find((row) => row.id === userId);
      const next =
        user && money(Number(user.user_account_balance) + Number(amount));
      const guarded = sql.includes('"user_account_balance" + $1::numeric >= 0');
      if (!user || (guarded && next < 0)) {
        return [[], 0];
      }
      user.user_account_balance = next;
      return [[{ user_account_balance: next.toFixed(2) }], 1];
    }

    if (
      sql.startsWith(
        'UPDATE "checklist_submissions" SET "reservationId" = NULL',
      )
    ) {
      const attached = this.checklistSubmissions.filter(
        (submission) => submission.reservationId === parameters[0],
      );
      attached.forEach((submission) => (submission.reservationId = null));
      return [[], attached.length];
    }

    if (sql.startsWith('UPDATE "flights" SET "departure_time" = ')) {
      const [reservationId, shift] = parameters as [number, number];
      const open = this.flights.filter(
        (flight) => flight.reservationId === reservationId && !flight.closed_at,
      );
      const moved = (date?: Date | null) =>
        date ? new Date(new Date(date).getTime() + shift) : date;
      for (const flight of open) {
        flight.departure_time = moved(flight.departure_time);
        flight.arrival_time = moved(flight.arrival_time);
      }
      return [[], open.length];
    }

    // The showcase invoice series: no showcase in these tests.
    if (sql.startsWith('UPDATE "showcase_state"')) {
      return [[], 0];
    }

    // The year's invoice counter: created at 1, or raised by one.
    if (sql.startsWith('INSERT INTO "invoice_sequences"')) {
      const year = Number(parameters[0]);
      const next = (this.invoiceSequences.get(year) ?? 0) + 1;
      this.invoiceSequences.set(year, next);
      return [{ last_number: next }];
    }

    throw new Error(`Fake database: unexpected statement ${sql}`);
  }

  private transaction(work: (manager: unknown) => Promise<unknown>) {
    const run = this.queue.then(async () => {
      const snapshot = {
        tables: new Map(
          [...this.tables].map(([entity, rows]) => [
            entity,
            structuredClone(rows),
          ]),
        ),
        sequences: new Map(this.sequences),
        invoiceSequences: new Map(this.invoiceSequences),
        checklistSubmissions: structuredClone(this.checklistSubmissions),
        flights: structuredClone(this.flights),
      };
      try {
        return await work(this.manager);
      } catch (error) {
        this.tables = snapshot.tables;
        this.sequences = snapshot.sequences;
        this.invoiceSequences = snapshot.invoiceSequences;
        this.checklistSubmissions = snapshot.checklistSubmissions;
        this.flights = snapshot.flights;
        throw error;
      }
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}

// The entities the fake knows, for tests that seed it.
export const tables = {
  Aircraft,
  InstructionCourse,
  Invoice,
  Maintenance,
  Payment,
  Reservation,
  User,
};
