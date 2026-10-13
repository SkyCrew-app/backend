import { ConflictException, ForbiddenException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { MemberDepartureService } from '../member-departure.service';
import { MemberDepartureResolver } from '../member-departure.resolver';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { ADMIN_ACTION } from '../../../common/admin-actions/admin-actions';

const NOW = new Date('2026-10-13T10:00:00Z');

describe('MemberDepartureService', () => {
  let service: MemberDepartureService;
  let users: { assertMayDeactivate: jest.Mock; setActive: jest.Mock };
  let bookings: { delete: jest.Mock };
  let reservations: { find: jest.Mock };
  let courses: { find: jest.Mock };

  const upcoming = [
    { id: 11, charged_amount: 150, start_time: new Date('2026-10-20') },
    { id: 12, charged_amount: 80.5, start_time: new Date('2026-11-02') },
    { id: 13, charged_amount: null, start_time: new Date('2026-11-05') },
  ];

  // Bookings of other members this member was to instruct.
  let instructed: any[];

  beforeEach(() => {
    instructed = [];
    users = {
      assertMayDeactivate: jest.fn().mockResolvedValue({ id: 5 }),
      setActive: jest.fn().mockResolvedValue({ id: 5, is_active: false }),
    };
    bookings = { delete: jest.fn().mockResolvedValue(undefined) };
    // The member's own bookings, then those they instruct.
    reservations = {
      find: jest.fn(async ({ where }) =>
        where.instructor ? instructed : upcoming,
      ),
    };
    courses = { find: jest.fn().mockResolvedValue([{ id: 31 }, { id: 32 }]) };
    service = new MemberDepartureService(
      users as any,
      bookings as any,
      reservations as any,
      courses as any,
    );
  });

  it('lists the bookings not started yet and the courses still to come', async () => {
    const commitments = await service.commitmentsOf(5, NOW);

    expect(commitments.upcomingReservations).toHaveLength(3);
    expect(commitments.upcomingCourses).toHaveLength(2);

    const where = reservations.find.mock.calls[0][0].where;
    expect(where.user).toEqual({ id: 5 });
    expect(where.start_time).toBeInstanceOf(FindOperator);
    expect(where.start_time.type).toBe('moreThan');
    expect(where.start_time.value).toBe(NOW);
    // Cancelled bookings are not counted.
    expect(where.status.type).toBe('not');

    // As a student and as an instructor, scheduled or in progress only.
    const courseWhere = courses.find.mock.calls[0][0].where;
    expect(courseWhere).toHaveLength(2);
    expect(courseWhere[0].student).toEqual({ id: 5 });
    expect(courseWhere[1].instructor).toEqual({ id: 5 });
    expect(courseWhere[0].status.value).toEqual(['SCHEDULED', 'IN_PROGRESS']);
  });

  it('deactivates without touching the bookings unless asked to cancel them', async () => {
    const result = await service.deactivate(5, false, NOW);

    expect(bookings.delete).not.toHaveBeenCalled();
    expect(users.setActive).toHaveBeenCalledWith(5, false);
    expect(result).toMatchObject({
      upcomingReservations: 3,
      cancelledReservations: 0,
      refundedAmount: 0,
      keptReservationIds: [],
      upcomingCourses: 2,
    });
  });

  it('cancels each booking through the ordinary cancellation, as an administrator, before closing the account', async () => {
    const order: string[] = [];
    bookings.delete.mockImplementation(async (id) => {
      order.push(`cancel:${id}`);
    });
    users.setActive.mockImplementation(async () => {
      order.push('deactivate');
      return { id: 5, is_active: false };
    });

    const result = await service.deactivate(5, true, NOW);

    // One call per booking: the cancellation refunds exactly what each one
    // cost, once (see ReservationsService.delete).
    expect(bookings.delete.mock.calls).toEqual([
      [11, { isAdmin: true }, NOW],
      [12, { isAdmin: true }, NOW],
      [13, { isAdmin: true }, NOW],
    ]);
    expect(order).toEqual([
      'cancel:11',
      'cancel:12',
      'cancel:13',
      'deactivate',
    ]);
    expect(result).toMatchObject({
      upcomingReservations: 3,
      cancelledReservations: 3,
      refundedAmount: 230.5,
      keptReservationIds: [],
    });
  });

  it('keeps a booking the cancellation refuses, reports it, and still closes the account', async () => {
    bookings.delete.mockImplementation(async (id) => {
      if (id === 12) throw new ConflictException('vol clôturé');
    });

    const result = await service.deactivate(5, true, NOW);

    expect(result.cancelledReservations).toBe(2);
    expect(result.keptReservationIds).toEqual([12]);
    // Only what was actually given back is announced.
    expect(result.refundedAmount).toBe(150);
    expect(users.setActive).toHaveBeenCalledWith(5, false);
  });

  describe('a member who instructs bookings of other members', () => {
    beforeEach(() => {
      instructed = [
        { id: 21, charged_amount: 120, start_time: new Date('2026-10-22') },
        { id: 22, charged_amount: 60, start_time: new Date('2026-11-03') },
      ];
    });

    it('lists the bookings they instruct apart from their own', async () => {
      const commitments = await service.commitmentsOf(5, NOW);

      expect(commitments.upcomingReservations.map((b) => b.id)).toEqual([
        11, 12, 13,
      ]);
      expect(
        commitments.upcomingInstructionReservations.map((b) => b.id),
      ).toEqual([21, 22]);

      const where = reservations.find.mock.calls[1][0].where;
      expect(where.instructor).toEqual({ id: 5 });
      expect(where.user).toBeUndefined();
      expect(where.start_time.type).toBe('moreThan');
      expect(where.status.type).toBe('not');
    });

    it('leaves them in place and counts them when not asked to cancel', async () => {
      const result = await service.deactivate(5, false, NOW);

      expect(bookings.delete).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        upcomingInstructionReservations: 2,
        cancelledInstructionReservations: 0,
        refundedToStudents: 0,
      });
    });

    it('cancels them through the ordinary cancellation and counts what the students get back apart', async () => {
      bookings.delete.mockImplementation(async (id) => {
        if (id === 22) throw new ConflictException('vol clôturé');
      });

      const result = await service.deactivate(5, true, NOW);

      expect(bookings.delete.mock.calls.map(([id]) => id)).toEqual([
        11, 12, 13, 21, 22,
      ]);
      expect(bookings.delete).toHaveBeenCalledWith(21, { isAdmin: true }, NOW);
      expect(result).toMatchObject({
        cancelledReservations: 3,
        refundedAmount: 230.5,
        upcomingInstructionReservations: 2,
        cancelledInstructionReservations: 1,
        refundedToStudents: 120,
        keptReservationIds: [22],
      });
      expect(users.setActive).toHaveBeenCalledWith(5, false);
    });
  });

  it('cancels nothing when the account cannot be deactivated', async () => {
    users.assertMayDeactivate.mockRejectedValue(
      new ForbiddenException('dernier administrateur'),
    );

    await expect(service.deactivate(1, true, NOW)).rejects.toThrow(
      'dernier administrateur',
    );
    expect(bookings.delete).not.toHaveBeenCalled();
    expect(users.setActive).not.toHaveBeenCalled();
  });
});

describe('MemberDepartureResolver', () => {
  it('is for administrators only', () => {
    for (const operation of ['memberCommitments', 'deactivateMember']) {
      expect(
        Reflect.getMetadata(
          ROLES_KEY,
          MemberDepartureResolver.prototype[operation],
        ),
      ).toEqual(['Administrateur']);
    }
  });

  it('traces the deactivation with what happened to the bookings', async () => {
    const outcome = {
      user: { id: 5, first_name: 'Jean', last_name: 'Dupont' },
      upcomingReservations: 2,
      cancelledReservations: 2,
      refundedAmount: 300,
      keptReservationIds: [],
      upcomingInstructionReservations: 1,
      cancelledInstructionReservations: 1,
      refundedToStudents: 90,
      upcomingCourses: 1,
    };
    const departure = { deactivate: jest.fn().mockResolvedValue(outcome) };
    const trace = { record: jest.fn() };
    const resolver = new MemberDepartureResolver(
      departure as any,
      trace as any,
    );
    const admin = { id: 1, email: 'admin@test.fr' } as any;

    await expect(resolver.deactivateMember(5, true, admin)).resolves.toBe(
      outcome,
    );

    expect(departure.deactivate).toHaveBeenCalledWith(5, true);
    expect(trace.record).toHaveBeenCalledWith(
      admin,
      ADMIN_ACTION.MEMBER_DEACTIVATED,
      { type: 'member', id: 5, label: 'Jean Dupont' },
      expect.objectContaining({
        cancelledReservations: 2,
        refundedAmount: 300,
        cancelledInstructionReservations: 1,
        refundedToStudents: 90,
      }),
    );
  });
});
