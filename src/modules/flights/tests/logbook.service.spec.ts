import { LogbookService } from '../logbook.service';
import { LogbookRole, logbookRoleOf } from '../logbook-role';

// A query builder that records what it is asked and returns the given rows.
const fakeQuery = (rows: any[]) => {
  const query: any = { conditions: [] as string[], joins: [] as string[] };
  query.leftJoinAndSelect = jest.fn((relation: string) => {
    query.joins.push(relation);
    return query;
  });
  for (const method of ['where', 'andWhere']) {
    query[method] = jest.fn((condition: string) => {
      query.conditions.push(condition);
      return query;
    });
  }
  query.orderBy = jest.fn(() => query);
  query.getMany = jest.fn(async () => rows.map((row) => ({ ...row })));
  return query;
};

describe('LogbookService', () => {
  const ME = 8;
  // Me alone, me as a student with instructor 20, me instructing member 3.
  const flights = [
    { id: 1, flight_hours: 1, user: { id: ME }, instructor: null },
    { id: 2, flight_hours: 1.5, user: { id: ME }, instructor: { id: 20 } },
    { id: 3, flight_hours: 2, user: { id: 3 }, instructor: { id: ME } },
  ];
  const serviceOver = (rows: any[]) => {
    const query = fakeQuery(rows);
    const service = new LogbookService(
      { createQueryBuilder: jest.fn(() => query) } as any,
      { findOne: jest.fn() } as any,
    );
    return { service, query };
  };

  it('names the part taken in a flight', () => {
    expect(logbookRoleOf(flights[0], ME)).toBe(LogbookRole.PILOT_IN_COMMAND);
    expect(logbookRoleOf(flights[1], ME)).toBe(LogbookRole.DUAL);
    expect(logbookRoleOf(flights[2], ME)).toBe(LogbookRole.INSTRUCTOR);
  });

  it('lists the flights piloted and the flights instructed, each with its role', async () => {
    const { service, query } = serviceOver(flights);

    const entries = await service.getLogbookEntries(ME);

    expect(query.joins).toContain('flight.instructor');
    expect(query.conditions[0]).toBe(
      '(user.id = :userId OR instructor.id = :userId)',
    );
    expect(entries.map((flight) => [flight.id, flight.logbook_role])).toEqual([
      [1, 'PILOT_IN_COMMAND'],
      [2, 'DUAL'],
      [3, 'INSTRUCTOR'],
    ]);
  });

  it('filters on the role', async () => {
    const { service } = serviceOver(flights);

    const entries = await service.getLogbookEntries(ME, {
      role: LogbookRole.INSTRUCTOR,
    });

    expect(entries.map((flight) => flight.id)).toEqual([3]);
  });

  it('splits the total between pilot in command, dual and instruction given', async () => {
    const { service } = serviceOver(flights);

    const stats = await service.getLogbookStats(ME);

    expect(stats).toMatchObject({
      totalFlights: 3,
      totalHours: 4.5,
      pilotInCommandHours: 1,
      dualHours: 1.5,
      instructionGivenHours: 2,
    });
  });
});
