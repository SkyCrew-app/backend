import { Logger } from '@nestjs/common';
import { getMetadataArgsStorage } from 'typeorm';
import { UsersService } from '../../modules/users/users.service';
import {
  NotificationsService,
  READ_NOTIFICATIONS_LISTED,
} from '../../modules/notifications/notifications.service';
import {
  PAST_BOOKINGS_LISTED,
  ReservationsService,
} from '../../modules/reservations/reservations.service';
import { FlightsService } from '../../modules/flights/flights.service';
import { FLIGHTS_OF_MEMBER_LISTED } from '../../modules/flights/flight-rules';
import {
  AircraftService,
  FLEET_HISTORY_MONTHS,
  fleetHistoryStart,
} from '../../modules/aircraft/aircraft.service';
import { AircraftResolver } from '../../modules/aircraft/aircraft.resolver';
import { FinancialService } from '../../modules/financial/financial.service';
// Every entity that carries one of the new indexes.
import '../../modules/reservations/entity/reservations.entity';
import '../../modules/flights/entity/flights.entity';
import '../../modules/notifications/entity/notifications.entity';
import '../../modules/payments/entity/payments.entity';
import '../../modules/invoices/entity/invoices.entity';
import '../../modules/instruction-courses/entity/instruction-courses.entity';
import '../../modules/licenses/entity/licenses.entity';
import '../../modules/financial/entity/expense.entity';
import '../../modules/maintenance/entity/maintenance.entity';
import '../admin-actions/admin-action.entity';
import { AddQueryIndexes1794000000001 } from '../../migrations/1794000000001-AddQueryIndexes';

// What the main screens load, measured on a club with three years of
// history: these keep each request from carrying that whole history.
describe('query weight of the main screens', () => {
  it('loads only the role of the account behind a session', async () => {
    const users = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };
    const service = new UsersService(
      users as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.findSessionUser('jean@club.fr');

    expect(users.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ relations: ['role'] }),
    );
  });

  it('lists every unread notification and only the latest read ones', async () => {
    const repository = {
      find: jest.fn(async ({ where }) =>
        where.is_read
          ? [{ id: 1, notification_date: new Date('2026-01-01') }]
          : [{ id: 2, notification_date: new Date('2026-02-01') }],
      ),
    };
    const service = new NotificationsService(repository as any, {} as any);

    const listed = await service.findAllByUser(7);

    expect(listed.map((n) => n.id)).toEqual([2, 1]);
    const [unread, read] = repository.find.mock.calls.map(([o]) => o);
    expect(unread.where).toEqual({ user: { id: 7 }, is_read: false });
    expect(unread.take).toBeUndefined();
    expect(read.where).toEqual({ user: { id: 7 }, is_read: true });
    expect(read.take).toBe(READ_NOTIFICATIONS_LISTED);
  });

  it("lists all of a member's upcoming bookings and the latest past ones", async () => {
    const now = new Date('2026-10-14T10:00:00Z');
    const repository = {
      find: jest.fn(async ({ where }) =>
        where.end_time.type === 'lessThan'
          ? [{ id: 2 }, { id: 1 }] // newest first
          : [{ id: 3 }],
      ),
    };
    const service = new ReservationsService(
      repository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const listed = await service.findUserReservations(5, now);

    expect(listed.map((r) => r.id)).toEqual([1, 2, 3]);
    const [upcoming, past] = repository.find.mock.calls.map(([o]) => o);
    expect(upcoming.take).toBeUndefined();
    expect(upcoming.where.end_time.value).toBe(now);
    expect(past.take).toBe(PAST_BOOKINGS_LISTED);
    expect(past.order).toEqual({ start_time: 'DESC' });
  });

  it("caps a member's own flights, newest first", async () => {
    const flights = { find: jest.fn().mockResolvedValue([]) };
    const service = new FlightsService(
      flights as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.getFlightsByUser(5);

    expect(flights.find).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { id: 'DESC' },
        take: FLIGHTS_OF_MEMBER_LISTED,
      }),
    );
  });

  it('lists the fleet without its bookings, loading them only when asked for', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([{ id: 4, maintenances: [] }]),
      manager: { find: jest.fn().mockResolvedValue([{ id: 9 }]) },
    };
    const service = new AircraftService(repository as any);

    const fleet = await service.findAll();
    expect(repository.find).toHaveBeenCalledWith({
      relations: ['maintenances'],
    });

    const resolver = new AircraftResolver(service, {} as any);
    expect(await resolver.reservations(fleet[0])).toEqual([{ id: 9 }]);
    expect(repository.manager.find.mock.calls[0][1].where).toEqual({
      aircraft: { id: 4 },
    });
    // Already there: not loaded again.
    expect(
      await resolver.reservations({ id: 4, reservations: [] } as any),
    ).toEqual([]);
  });

  it('gives the fleet history the bookings of the last months, in one query', async () => {
    const since = new Date('2025-10-14T00:00:00Z');
    const repository = {
      find: jest.fn().mockResolvedValue([
        { id: 1, maintenances: [] },
        { id: 2, maintenances: [] },
      ]),
      manager: {
        find: jest.fn().mockResolvedValue([
          { id: 10, aircraft: { id: 2 } },
          { id: 11, aircraft: { id: 1 } },
        ]),
      },
    };
    const service = new AircraftService(repository as any);

    const fleet = await service.aircraftHistory({
      relations: ['maintenances'],
      bookingsSince: since,
    });

    expect(repository.find).toHaveBeenCalledWith({
      relations: ['maintenances'],
    });
    expect(repository.manager.find).toHaveBeenCalledTimes(1);
    const where = repository.manager.find.mock.calls[0][1].where;
    expect(where.start_time.type).toBe('moreThanOrEqual');
    expect(where.start_time.value).toBe(since);
    expect(fleet.map((a) => a.reservations.map((r) => r.id))).toEqual([
      [11],
      [10],
    ]);
    expect(
      fleetHistoryStart(new Date('2026-10-14T00:00:00Z')).toISOString(),
    ).toBe(
      new Date(
        new Date('2026-10-14T00:00:00Z').setMonth(9 - FLEET_HISTORY_MONTHS),
      ).toISOString(),
    );
  });

  it('sums the revenue from the charged amounts only, without members or aircraft', async () => {
    const reservations = {
      find: jest
        .fn()
        .mockResolvedValue([
          { charged_amount: 10.5 },
          { charged_amount: '4.5' },
        ]),
    };
    const service = new FinancialService(
      {} as any,
      {} as any,
      {} as any,
      reservations as any,
      { findOne: jest.fn().mockResolvedValue({ id: 1 }) } as any,
      {} as any,
    );

    expect(
      await service.aggregateRevenuesForPeriod(new Date(), new Date()),
    ).toBe(15);
    expect(reservations.find).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, charged_amount: true },
        loadEagerRelations: false,
      }),
    );
  });

  describe('indexes', () => {
    const created = async () => {
      const statements: string[] = [];
      await new AddQueryIndexes1794000000001().up({
        query: async (sql: string) => {
          statements.push(sql);
        },
      } as any);
      return statements.filter((sql) => sql.startsWith('CREATE INDEX'));
    };

    it('creates each index only when it is missing', async () => {
      const statements = await created();
      expect(statements.length).toBeGreaterThan(10);
      for (const sql of statements) {
        expect(sql).toMatch(/^CREATE INDEX IF NOT EXISTS "IDX_/);
      }
      expect(statements.join('\n')).toContain(
        'ON "notifications" ("userId", "is_read", "notification_date")',
      );
    });

    it('keeps going when one index cannot be created', async () => {
      const statements: string[] = [];
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      await new AddQueryIndexes1794000000001().up({
        query: async (sql: string) => {
          statements.push(sql);
          if (sql.startsWith('CREATE') && sql.includes('IDX_flights_user"'))
            throw new Error('no table');
        },
      } as any);
      expect(statements).toContain('ROLLBACK TO SAVEPOINT "IDX_flights_user"');
      expect(statements.some((sql) => sql.includes('IDX_expenses_date'))).toBe(
        true,
      );
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('declares on the entities every index the migration creates', async () => {
      const declared = new Set(
        getMetadataArgsStorage().indices.map((index) => index.name),
      );
      for (const sql of await created()) {
        const name = /"(IDX_[^"]+)"/.exec(sql)![1];
        expect(declared.has(name)).toBe(true);
      }
    });
  });
});
