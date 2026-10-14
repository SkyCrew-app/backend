import { ConflictException } from '@nestjs/common';
import { InstructorRoleChangeService } from '../instructor-role-change.service';
import { UsersService } from '../users.service';
import { UsersResolver } from '../users.resolver';
import { ADMIN_ACTION } from '../../../common/admin-actions/admin-actions';
import { renderTranslation } from '../../../common/i18n/translate';
import { translationOf } from '../../../common/i18n/localized-exception';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hash'),
  compare: jest.fn().mockResolvedValue(true),
}));

const NOW = new Date('2026-10-13T10:00:00Z');
const INSTRUCTOR_ROLE = { id: 3, role_name: 'Instructeur' };
const PILOT_ROLE = { id: 2, role_name: 'Pilote' };
const ADMIN_ROLE = { id: 1, role_name: 'Administrateur' };

const instructor = { id: 7, role: INSTRUCTOR_ROLE } as any;

const booking = (id: number, day: number, charged: number | null = 100) => ({
  id,
  start_time: new Date(`2026-10-${day}T08:00:00Z`),
  charged_amount: charged,
  aircraft: { registration_number: 'F-GABC' },
  user: { id: 40 + id, first_name: 'Élève', last_name: String(id) },
});

describe('InstructorRoleChangeService', () => {
  let service: InstructorRoleChangeService;
  let bookings: { delete: jest.Mock };
  let notifications: { create: jest.Mock };
  let reservations: { find: jest.Mock };
  let courses: { find: jest.Mock; update: jest.Mock };

  beforeEach(() => {
    bookings = { delete: jest.fn().mockResolvedValue(undefined) };
    notifications = { create: jest.fn().mockResolvedValue(undefined) };
    reservations = {
      find: jest
        .fn()
        .mockResolvedValue([
          booking(1, 20),
          booking(2, 21, 80.5),
          booking(3, 22, null),
        ]),
    };
    courses = {
      find: jest.fn().mockResolvedValue([
        {
          id: 31,
          startTime: new Date('2026-10-23T08:00:00Z'),
          student: { id: 50, first_name: 'Ada', language: 'en' },
          instructor: { id: 7, first_name: 'Jean', last_name: 'Prof' },
        },
      ]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    service = new InstructorRoleChangeService(
      bookings as any,
      notifications as any,
      reservations as any,
      courses as any,
    );
  });

  it('refuses to take the instructor role away while bookings and courses remain, naming them', async () => {
    const refusal = await service
      .settle(instructor, PILOT_ROLE, false, NOW)
      .catch((error) => error);

    expect(refusal).toBeInstanceOf(ConflictException);
    const translation = translationOf(refusal);
    expect(translation?.key).toBe('error.user.instructorCommitments');
    expect(translation?.params).toMatchObject({ bookings: 3, courses: 1 });
    // The first three, soonest first, then an ellipsis.
    const list = String(translation?.params?.list);
    expect(list).toContain('20/10/2026 10:00 F-GABC – Élève 1');
    expect(list).toContain('22/10/2026');
    expect(list).not.toContain('23/10/2026');
    expect(list.endsWith('…')).toBe(true);
    expect(
      renderTranslation('en', translation!.key, translation!.params),
    ).toContain('3 upcoming booking(s) and 1 upcoming course(s)');

    expect(bookings.delete).not.toHaveBeenCalled();
    expect(courses.update).not.toHaveBeenCalled();
  });

  it('only looks at the bookings the member instructs, still to come and not cancelled', async () => {
    await service.settle(instructor, PILOT_ROLE, false, NOW).catch(() => null);

    const where = reservations.find.mock.calls[0][0].where;
    expect(where.instructor).toEqual({ id: 7 });
    expect(where.start_time.type).toBe('moreThan');
    expect(where.start_time.value).toBe(NOW);
    expect(where.status.type).toBe('not');
    const courseWhere = courses.find.mock.calls[0][0].where;
    expect(courseWhere.instructor).toEqual({ id: 7 });
    expect(courseWhere.status.value).toEqual(['SCHEDULED', 'IN_PROGRESS']);
  });

  it('cancels the bookings through the ordinary cancellation and the courses when confirmed', async () => {
    const outcome = await service.settle(instructor, PILOT_ROLE, true, NOW);

    // Each booking once, as an administrator: the cancellation refunds
    // the student what they paid.
    expect(bookings.delete).toHaveBeenCalledTimes(3);
    expect(bookings.delete).toHaveBeenCalledWith(1, { isAdmin: true }, NOW);
    expect(bookings.delete).toHaveBeenCalledWith(2, { isAdmin: true }, NOW);
    expect(bookings.delete).toHaveBeenCalledWith(3, { isAdmin: true }, NOW);
    expect(courses.update).toHaveBeenCalledWith(
      { id: 31 },
      { status: 'CANCELED' },
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 50,
        notification_type: 'COURSE_CANCELLED',
        message: expect.stringContaining('no longer an instructor'),
      }),
    );
    expect(outcome).toEqual({
      cancelledInstructionReservations: 3,
      refundedToStudents: 180.5,
      cancelledCourses: 1,
    });
  });

  it('keeps the role when a booking cannot be cancelled, and leaves the courses alone', async () => {
    bookings.delete.mockImplementation(async (id: number) => {
      if (id === 2) {
        throw new ConflictException('closed');
      }
    });

    const refusal = await service
      .settle(instructor, PILOT_ROLE, true, NOW)
      .catch((error) => error);

    expect(translationOf(refusal)?.key).toBe(
      'error.user.instructorBookingsNotCancelled',
    );
    expect(translationOf(refusal)?.params).toEqual({ ids: '2' });
    expect(courses.update).not.toHaveBeenCalled();
  });

  it('lets an instructor become administrator with their courses, not their bookings', async () => {
    await service.settle(instructor, ADMIN_ROLE, false, NOW).catch(() => null);

    expect(reservations.find).toHaveBeenCalled();
    expect(courses.find).not.toHaveBeenCalled();
  });

  it('has nothing to say about a member who was not an instructor', async () => {
    const outcome = await service.settle(
      { id: 8, role: PILOT_ROLE } as any,
      ADMIN_ROLE,
      false,
      NOW,
    );

    expect(reservations.find).not.toHaveBeenCalled();
    expect(courses.find).not.toHaveBeenCalled();
    expect(outcome.cancelledInstructionReservations).toBe(0);
  });

  it('goes through without confirmation when nothing is ahead', async () => {
    reservations.find.mockResolvedValue([]);
    courses.find.mockResolvedValue([]);

    await expect(
      service.settle(instructor, PILOT_ROLE, false, NOW),
    ).resolves.toEqual({
      cancelledInstructionReservations: 0,
      refundedToStudents: 0,
      cancelledCourses: 0,
    });
  });
});

describe('updateUser with a role change', () => {
  let users: any;
  let service: UsersService;
  let settle: jest.Mock;
  let record: jest.Mock;
  let resolver: UsersResolver;
  const admin = { id: 1, email: 'admin@club.fr', role: ADMIN_ROLE } as any;

  beforeEach(() => {
    const member = () => ({
      id: 7,
      email: 'prof@club.fr',
      first_name: 'Jean',
      last_name: 'Prof',
      language: 'fr',
      role: { ...INSTRUCTOR_ROLE },
    });
    users = {
      findOne: jest.fn().mockImplementation(async () => member()),
      save: jest.fn().mockImplementation(async (user) => user),
      count: jest.fn().mockResolvedValue(1),
      manager: {
        getRepository: () => ({
          findOne: jest.fn().mockResolvedValue(PILOT_ROLE),
        }),
      },
    };
    service = new UsersService(
      users,
      { sendMail: jest.fn() } as any,
      {} as any,
      {} as any,
      { create: jest.fn() } as any,
    );
    settle = jest.fn().mockResolvedValue({
      cancelledInstructionReservations: 2,
      refundedToStudents: 150,
      cancelledCourses: 1,
    });
    record = jest.fn();
    resolver = new UsersResolver(
      service,
      { record } as any,
      {
        settle,
      } as any,
    );
  });

  it('passes the confirmation on and refuses the change when the commitments refuse it', async () => {
    settle.mockRejectedValue(new ConflictException('commitments'));

    await expect(
      resolver.updateUser(
        { email: 'prof@club.fr', roleId: 2 },
        undefined,
        admin,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(settle).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7 }),
      PILOT_ROLE,
      false,
    );
    // Nothing written, nothing traced.
    expect(users.save).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('records what the confirmed change cancelled in the administrator log', async () => {
    const updated = await resolver.updateUser(
      { email: 'prof@club.fr', roleId: 2, cancelInstructionCommitments: true },
      undefined,
      admin,
    );

    expect(settle).toHaveBeenCalledWith(expect.anything(), PILOT_ROLE, true);
    expect(updated.role).toEqual(PILOT_ROLE);
    expect(record).toHaveBeenCalledWith(
      admin,
      ADMIN_ACTION.MEMBER_ROLE_CHANGED,
      expect.objectContaining({ type: 'member', id: 7 }),
      {
        from: 'Instructeur',
        to: 'Pilote',
        cancelledInstructionReservations: 2,
        refundedToStudents: 150,
        cancelledCourses: 1,
      },
    );
  });

  it('does not ask anything when the role stays the same', async () => {
    users.manager.getRepository = () => ({
      findOne: jest.fn().mockResolvedValue(INSTRUCTOR_ROLE),
    });

    await resolver.updateUser(
      { email: 'prof@club.fr', roleId: 3, first_name: 'Jeanne' },
      undefined,
      admin,
    );

    expect(settle).not.toHaveBeenCalled();
  });
});
