import { InstructionCoursesService } from '../instruction-courses.service';
import { translationOf } from '../../../common/i18n/localized-exception';
import { tables } from '../../../../test/support/fake-database';
import {
  bookingWorld,
  NOW,
  SLOT,
} from '../../../../test/support/booking-world';

const HOUR = 60 * 60 * 1000;
const at = (date: Date, hours: number) =>
  new Date(date.getTime() + hours * HOUR);

const refusal = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (caught) => caught,
  );
  return translationOf(error)?.key ?? error?.message ?? null;
};

// A course of one hour with its aircraft booked over the same hour, in the
// fake club of the booking tests.
const courseWithBooking = async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
  const world = bookingWorld({ balance: 500, rate: 150 });
  const student = world.member;
  const instructor = world.database.insert(tables.User, {
    first_name: 'Irene',
    last_name: 'Morel',
    email: 'irene@test.com',
    language: 'en',
    is_active: true,
    user_account_balance: 0,
    role: { role_name: 'Instructeur' },
    licenses: [
      {
        license_type: 'PPL',
        is_valid: true,
        status: 'active',
        expiration_date: new Date('2028-01-01T00:00:00Z'),
      },
    ],
  });
  const course = world.database.insert(tables.InstructionCourse, {
    instructor: { id: instructor.id },
    student: { id: student.id },
    startTime: SLOT.start_time,
    endTime: SLOT.end_time,
    status: 'SCHEDULED',
    reservation: null,
  });
  const booking = await world.reservations.create(
    world.input({ instructor_id: instructor.id, course_id: course.id }),
    NOW,
  );
  const users = {
    findOneById: jest.fn(async (id: number) =>
      world.database.rows(tables.User).find((user) => user.id === id),
    ),
  };
  const courses = new InstructionCoursesService(
    world.database.repository(tables.InstructionCourse),
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    users as any,
    world.notifications as any,
    {} as any,
    world.reservations,
  );
  const asInstructor = {
    id: instructor.id,
    email: 'irene@test.com',
    role: { role_name: 'Instructeur' },
  };
  const bookingRow = () =>
    world.database
      .rows(tables.Reservation)
      .find((row) => row.id === booking.id);
  const courseRow = () => world.database.rows(tables.InstructionCourse)[0];
  return {
    world,
    instructor,
    course,
    booking,
    courses,
    asInstructor,
    bookingRow,
    courseRow,
  };
};

describe('Moving a course that has an aircraft booking', () => {
  afterEach(() => jest.useRealTimers());

  it('moves the booking with the course, priced again', async () => {
    const { world, course, courses, asInstructor, bookingRow, courseRow } =
      await courseWithBooking();
    // 1 h at 150 + the instructor's fee.
    const paidBefore = 500 - world.balance();

    const moved = await courses.updateCourse(
      course.id,
      {
        id: course.id,
        startTime: at(SLOT.start_time, 2),
        endTime: at(SLOT.end_time, 3),
      },
      asInstructor,
    );

    expect(new Date(moved.startTime)).toEqual(at(SLOT.start_time, 2));
    expect(new Date(courseRow().endTime)).toEqual(at(SLOT.end_time, 3));
    expect(new Date(bookingRow().start_time)).toEqual(at(SLOT.start_time, 2));
    expect(new Date(bookingRow().end_time)).toEqual(at(SLOT.end_time, 3));
    expect(courseRow().reservation).toEqual({ id: bookingRow().id });
    // Two hours now: the student paid for one more.
    expect(500 - world.balance()).toBeCloseTo(paidBefore * 2, 2);
  });

  it('refuses the whole change when the booking cannot follow, with the reason', async () => {
    const { world, course, courses, asInstructor, bookingRow, courseRow } =
      await courseWithBooking();
    // Another member holds the aircraft two hours later.
    world.database.insert(tables.Reservation, {
      aircraft: { id: world.aircraft.id },
      user: { id: 999 },
      start_time: at(SLOT.start_time, 2),
      end_time: at(SLOT.end_time, 2),
      status: 'CONFIRMED',
    });
    const balance = world.balance();

    expect(
      await refusal(
        courses.updateCourse(
          course.id,
          {
            id: course.id,
            startTime: at(SLOT.start_time, 2),
            endTime: at(SLOT.end_time, 2),
          },
          asInstructor,
        ),
      ),
    ).toBe('error.reservation.aircraftAlreadyBooked');

    expect(new Date(courseRow().startTime)).toEqual(SLOT.start_time);
    expect(new Date(bookingRow().start_time)).toEqual(SLOT.start_time);
    expect(world.balance()).toBe(balance);
  });

  it('refuses to move a course whose flight has already started', async () => {
    const { course, courses, asInstructor, courseRow } =
      await courseWithBooking();
    jest.setSystemTime(at(SLOT.start_time, 0.5));

    expect(
      await refusal(
        courses.updateCourse(
          course.id,
          {
            id: course.id,
            startTime: at(SLOT.start_time, 3),
            endTime: at(SLOT.end_time, 3),
          },
          asInstructor,
        ),
      ),
    ).not.toBeNull();
    expect(new Date(courseRow().startTime)).toEqual(SLOT.start_time);
  });

  it('does not let the booking alone drift away from its course', async () => {
    const { world, booking, bookingRow } = await courseWithBooking();

    expect(
      await refusal(
        world.reservations.update(
          {
            id: booking.id,
            start_time: at(SLOT.start_time, 4),
            end_time: at(SLOT.end_time, 4),
          } as any,
          NOW,
        ),
      ),
    ).toBe('error.reservation.courseSlotMismatch');
    expect(new Date(bookingRow().start_time)).toEqual(SLOT.start_time);

    // Still over the course: allowed.
    await world.reservations.update(
      { id: booking.id, end_time: at(SLOT.end_time, 0.5) } as any,
      NOW,
    );
    expect(new Date(bookingRow().end_time)).toEqual(at(SLOT.end_time, 0.5));
  });

  it('refuses another instructor or student while the course has its booking', async () => {
    const { world, course, courses } = await courseWithBooking();
    const other = world.database.insert(tables.User, {
      first_name: 'Other',
      is_active: true,
      role: { role_name: 'Instructeur' },
    });

    expect(
      await refusal(
        courses.updateCourse(
          course.id,
          { id: course.id, instructorId: other.id },
          { id: 1, email: 'admin@test.com', role: 'Administrateur' },
        ),
      ),
    ).toBe('error.course.bookedParticipants');
  });

  it('changes nothing on the booking when only the status changes', async () => {
    const { course, courses, asInstructor, bookingRow } =
      await courseWithBooking();

    await courses.updateCourse(
      course.id,
      { id: course.id, status: 'IN_PROGRESS' as any },
      asInstructor,
    );

    expect(new Date(bookingRow().start_time)).toEqual(SLOT.start_time);
  });
});

describe('The course of a booking', () => {
  afterEach(() => jest.useRealTimers());

  it('is found from the booking until a change of instructor detaches it', async () => {
    const { world, course, booking } = await courseWithBooking();
    expect(await world.reservations.findCourseOf(booking.id)).toEqual(
      expect.objectContaining({ id: course.id }),
    );

    const other = world.database.insert(tables.User, {
      first_name: 'Otto',
      last_name: 'Blanc',
      email: 'otto@test.com',
      is_active: true,
      user_account_balance: 0,
      role: { role_name: 'Instructeur' },
      licenses: [
        {
          license_type: 'PPL',
          is_valid: true,
          status: 'active',
          expiration_date: new Date('2028-01-01T00:00:00Z'),
        },
      ],
    });
    await world.reservations.update(
      { id: booking.id, instructor_id: other.id } as any,
      NOW,
    );

    expect(await world.reservations.findCourseOf(booking.id)).toBeNull();
  });
});

describe('Cancelling a course that has an aircraft booking', () => {
  afterEach(() => jest.useRealTimers());

  it('cancels the booking too when asked, refunded once, with its notices', async () => {
    const { world, course, courses, asInstructor, bookingRow, courseRow } =
      await courseWithBooking();
    expect(world.balance()).toBeLessThan(500);
    world.notifications.create.mockClear();
    world.mailer.sendMail.mockClear();

    const cancelled = await courses.updateCourse(
      course.id,
      { id: course.id, status: 'CANCELED' as any, cancelBooking: true },
      asInstructor,
    );

    expect(cancelled.status).toBe('CANCELED');
    expect(courseRow().status).toBe('CANCELED');
    expect(courseRow().reservation).toBeNull();
    expect(bookingRow()).toBeUndefined();
    // Everything the student paid for the booking comes back, once.
    expect(world.balance()).toBeCloseTo(500, 2);
    expect(world.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ notification_type: 'RESERVATION_CANCELLED' }),
    );
    expect(world.mailer.sendMail).toHaveBeenCalled();

    // Cancelling again cannot refund a second time.
    expect(
      await refusal(
        courses.updateCourse(
          course.id,
          { id: course.id, status: 'CANCELED' as any, cancelBooking: true },
          asInstructor,
        ),
      ),
    ).toBe('error.course.cancelBookingWithoutCancelling');
    expect(world.balance()).toBeCloseTo(500, 2);
  });

  it('keeps the booking, still paid, when not asked to cancel it', async () => {
    const { world, course, courses, asInstructor, bookingRow, courseRow } =
      await courseWithBooking();
    const balance = world.balance();

    await courses.updateCourse(
      course.id,
      { id: course.id, status: 'CANCELED' as any },
      asInstructor,
    );

    expect(courseRow().status).toBe('CANCELED');
    expect(bookingRow()).toBeDefined();
    expect(world.balance()).toBe(balance);
  });

  it('refuses the whole cancellation when the booking can no longer be cancelled, with the reason', async () => {
    const { world, course, courses, asInstructor, bookingRow, courseRow } =
      await courseWithBooking();
    const balance = world.balance();
    // The flight has started: only an administrator cancels the booking now.
    jest.setSystemTime(at(SLOT.start_time, 0.5));

    expect(
      await refusal(
        courses.updateCourse(
          course.id,
          { id: course.id, status: 'CANCELED' as any, cancelBooking: true },
          asInstructor,
        ),
      ),
    ).toBe('error.reservation.cancelAfterStart');

    expect(courseRow().status).toBe('SCHEDULED');
    expect(courseRow().reservation).toEqual({ id: bookingRow().id });
    expect(world.balance()).toBe(balance);
  });

  it('refuses to cancel a booking along with anything but a cancellation', async () => {
    const { course, courses, asInstructor, bookingRow } =
      await courseWithBooking();

    expect(
      await refusal(
        courses.updateCourse(
          course.id,
          { id: course.id, status: 'IN_PROGRESS' as any, cancelBooking: true },
          asInstructor,
        ),
      ),
    ).toBe('error.course.cancelBookingWithoutCancelling');
    expect(bookingRow()).toBeDefined();
  });
});

describe('Deleting a course that has an aircraft booking', () => {
  afterEach(() => jest.useRealTimers());

  it('cancels the booking too when asked, refunded', async () => {
    const { world, course, courses, asInstructor, bookingRow } =
      await courseWithBooking();

    await expect(
      courses.deleteCourse(course.id, true, asInstructor),
    ).resolves.toBe(true);

    expect(world.database.rows(tables.InstructionCourse)).toHaveLength(0);
    expect(bookingRow()).toBeUndefined();
    expect(world.balance()).toBeCloseTo(500, 2);
  });

  it('keeps the booking, still paid, when not asked to cancel it', async () => {
    const { world, course, courses, bookingRow } = await courseWithBooking();
    const balance = world.balance();

    // (The fake repository does not delete by id: the course row itself is
    // covered by the service tests.)
    await courses.deleteCourse(course.id);

    expect(bookingRow()).toBeDefined();
    expect(world.balance()).toBe(balance);
  });

  it('deletes nothing when the booking can no longer be cancelled, and says why', async () => {
    const { world, course, courses, asInstructor, bookingRow } =
      await courseWithBooking();
    const balance = world.balance();
    jest.setSystemTime(at(SLOT.start_time, 0.5));

    expect(
      await refusal(courses.deleteCourse(course.id, true, asInstructor)),
    ).toBe('error.reservation.cancelAfterStart');
    expect(world.database.rows(tables.InstructionCourse)).toHaveLength(1);
    expect(bookingRow()).toBeDefined();
    expect(world.balance()).toBe(balance);
  });
});
