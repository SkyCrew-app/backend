import { translationOf } from '../../../common/i18n/localized-exception';
import { FlightCategory } from '../entity/reservations.entity';
import { tables } from '../../../../test/support/fake-database';
import {
  bookingWorld,
  NOW,
  SLOT,
} from '../../../../test/support/booking-world';
import { INSTRUCTOR_FEE_PER_HOUR } from '../booking-rules';

const HOUR = 60 * 60 * 1000;
const refusal = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (caught) => caught,
  );
  return translationOf(error)?.key ?? error?.message ?? null;
};

const VALID_LICENCE = {
  license_type: 'PPL',
  is_valid: true,
  status: 'active',
  expiration_date: new Date('2028-01-01T00:00:00Z'),
};

// The club of the booking tests, with an instructor, and its member turned
// into a student pilot (no licence) unless told otherwise.
const instructionWorld = (options: { licensed?: boolean } = {}) => {
  const world = bookingWorld({ balance: 500, rate: 150 });
  const student = world.database.rows(tables.User)[0];
  student.last_name = 'Student';
  if (!options.licensed) student.licenses = [];

  const instructor = world.database.insert(tables.User, {
    first_name: 'Irene',
    last_name: 'Morel',
    email: 'irene@test.com',
    language: 'en',
    is_active: true,
    user_account_balance: 0,
    role: { role_name: 'Instructeur' },
    licenses: [{ ...VALID_LICENCE }],
  });
  const book = (overrides: object = {}) =>
    world.reservations.create(
      world.input({ instructor_id: instructor.id, ...overrides }),
      NOW,
    );
  const told = (userId: number) =>
    world.notifications.create.mock.calls
      .map(([notification]) => notification)
      .filter((notification) => notification.user_id === userId);

  return { ...world, student, instructor, book, told };
};

const later = (hours: number) => ({
  start_time: new Date(SLOT.start_time.getTime() + hours * HOUR),
  end_time: new Date(SLOT.end_time.getTime() + hours * HOUR),
});

describe('Instruction flights: a booking with an instructor', () => {
  describe('who may book', () => {
    it('lets a member without a licence book with an instructor, and only so', async () => {
      const world = instructionWorld();

      expect(await refusal(world.book({ instructor_id: undefined }))).toBe(
        'error.reservation.instructorRequired',
      );
      expect(
        await refusal(
          world.book({
            instructor_id: null,
            flight_category: FlightCategory.INSTRUCTION,
          }),
        ),
      ).toBe('error.reservation.instructorRequired');
      expect(world.database.rows(tables.Reservation)).toHaveLength(0);

      const booking = await world.book();

      expect(booking.instructor).toMatchObject({ id: world.instructor.id });
      expect(world.database.rows(tables.Reservation)[0].instructor).toEqual({
        id: world.instructor.id,
      });
    });

    it('lets a licensed member add an instructor, or fly without', async () => {
      const world = instructionWorld({ licensed: true });

      const dual = await world.book();
      const solo = await world.book({ instructor_id: null, ...later(2) });

      expect(dual.instructor.id).toBe(world.instructor.id);
      expect(solo.instructor).toBeNull();
    });

    it('makes a flight with an instructor an instruction flight', async () => {
      const world = instructionWorld({ licensed: true });

      const booking = await world.book({
        flight_category: FlightCategory.TOURISM,
      });

      expect(booking.flight_category).toBe(FlightCategory.INSTRUCTION);
    });

    it('asks the instructor for the valid licence, whatever the pilot holds', async () => {
      const world = instructionWorld({ licensed: true });
      world.database.rows(tables.User)[1].licenses[0].expiration_date =
        new Date('2027-01-01T00:00:00Z');

      expect(await refusal(world.book())).toBe(
        'error.reservation.instructorNoValidLicence',
      );
      expect(world.balance()).toBe(500);
    });

    it.each([
      [
        'a member who is not an instructor',
        (user: any) => (user.role = { role_name: 'Pilote' }),
        'error.reservation.notAnInstructor',
      ],
      [
        'an administrator',
        (user: any) => (user.role = { role_name: 'Administrateur' }),
        'error.reservation.notAnInstructor',
      ],
      [
        'a deactivated instructor',
        (user: any) => (user.is_active = false),
        'error.reservation.notAnInstructor',
      ],
    ])('refuses %s as the instructor', async (_case, arrange, key) => {
      const world = instructionWorld();
      arrange(world.database.rows(tables.User)[1]);

      expect(await refusal(world.book())).toBe(key);
      expect(world.database.rows(tables.Reservation)).toHaveLength(0);
    });

    it('refuses an unknown instructor, and the pilot as their own instructor', async () => {
      const world = instructionWorld();
      world.database.rows(tables.User)[0].role = { role_name: 'Instructeur' };

      expect(await refusal(world.book({ instructor_id: 999 }))).toBe(
        'error.reservation.instructorNotFound',
      );
      expect(
        await refusal(world.book({ instructor_id: world.student.id })),
      ).toBe('error.reservation.instructorIsPilot');
    });
  });

  describe('what the student pays', () => {
    it('charges the aircraft to the student and nothing for the instructor', async () => {
      const world = instructionWorld();

      const booking = await world.book();

      // OWNER DECISION PENDING: no instructor fee.
      expect(INSTRUCTOR_FEE_PER_HOUR).toBe(0);
      expect(booking.charged_amount).toBe(150);
      expect(world.balance()).toBe(350);
      expect(world.database.balanceOf(world.instructor.id)).toBe(0);
      expect(world.paymentLines()).toEqual(['booking:150.00']);
      expect(world.database.rows(tables.Payment)[0].user).toEqual({
        id: world.student.id,
      });
    });
  });

  describe('the agenda of the instructor', () => {
    const secondStudent = (world: ReturnType<typeof instructionWorld>) =>
      world.database.insert(tables.User, {
        first_name: 'Paul',
        email: 'paul@test.com',
        user_account_balance: 500,
        licenses: [],
      });

    it('refuses the same instructor on two aircraft at once, and accepts the slot after', async () => {
      const world = instructionWorld();
      const other = secondStudent(world);
      await world.book();

      const second = {
        user_id: other.id,
        aircraft_id: world.otherAircraft.id,
      };
      expect(await refusal(world.book(second))).toBe(
        'error.reservation.instructorAlreadyBooked',
      );
      expect(await refusal(world.book({ ...second, ...later(1) }))).toBeNull();
    });

    it('refuses an instructor who flies as pilot elsewhere at that time, and the reverse', async () => {
      const world = instructionWorld();
      world.database.rows(tables.User)[1].user_account_balance = 500;
      // The instructor's own flight, on the other aircraft.
      await world.reservations.create(
        world.input({
          user_id: world.instructor.id,
          aircraft_id: world.otherAircraft.id,
        }),
        NOW,
      );

      expect(await refusal(world.book())).toBe(
        'error.reservation.instructorAlreadyBooked',
      );

      // The reverse: instructing first, then booking a flight of their own.
      await world.book(later(3));
      expect(
        await refusal(
          world.reservations.create(
            world.input({
              user_id: world.instructor.id,
              aircraft_id: world.otherAircraft.id,
              ...later(3),
            }),
            NOW,
          ),
        ),
      ).toBe('error.reservation.pilotAlreadyBooked');
    });

    it('refuses a pilot who instructs elsewhere at that time', async () => {
      const world = instructionWorld();
      const other = secondStudent(world);
      // Irene instructs Paul…
      await world.book({ user_id: other.id });
      // …so she cannot be the student of another instructor meanwhile.
      const colleague = world.database.insert(tables.User, {
        first_name: 'Luc',
        email: 'luc@test.com',
        role: { role_name: 'Instructeur' },
        licenses: [{ ...VALID_LICENCE }],
      });

      expect(
        await refusal(
          world.book({
            user_id: world.instructor.id,
            instructor_id: colleague.id,
            aircraft_id: world.otherAircraft.id,
          }),
        ),
      ).toBe('error.reservation.pilotAlreadyBooked');
    });

    it('is blocked by a course the instructor gives another student, not by one with this student', async () => {
      const world = instructionWorld();
      const course = world.database.insert(tables.InstructionCourse, {
        instructor: { id: world.instructor.id },
        student: { id: 99 },
        startTime: new Date(SLOT.start_time.getTime() + HOUR / 2),
        endTime: new Date(SLOT.end_time.getTime() + HOUR / 2),
        status: 'SCHEDULED',
      });

      expect(await refusal(world.book())).toBe(
        'error.reservation.instructorHasCourse',
      );

      // A cancelled course frees the instructor.
      world.database.rows(tables.InstructionCourse)[0].status = 'CANCELED';
      expect(course.id).toBeDefined();
      expect(await refusal(world.book())).toBeNull();

      // A course with the student of the booking is the flight itself.
      world.database.insert(tables.InstructionCourse, {
        instructor: { id: world.instructor.id },
        student: { id: world.student.id },
        startTime: later(2).start_time,
        endTime: later(2).end_time,
        status: 'SCHEDULED',
      });
      expect(await refusal(world.book(later(2)))).toBeNull();
    });

    it('counts a course without an end as lasting the default hour', async () => {
      const world = instructionWorld();
      world.database.insert(tables.InstructionCourse, {
        instructor: { id: world.instructor.id },
        student: { id: 99 },
        startTime: new Date(SLOT.start_time.getTime() - HOUR / 2),
        endTime: null,
        status: 'SCHEDULED',
      });

      expect(await refusal(world.book())).toBe(
        'error.reservation.instructorHasCourse',
      );
      expect(await refusal(world.book(later(1)))).toBeNull();
    });

    it('locks the aircraft, then the pilot and the instructor in the order of their ids', async () => {
      const world = instructionWorld();

      await world.book();

      expect(world.database.locks).toEqual([
        `aircraft:${world.aircraft.id}`,
        `users:${world.student.id}`,
        `users:${world.instructor.id}`,
      ]);
    });
  });

  describe('what the instructor is told', () => {
    it('notifies and writes to the instructor on creation, in their language', async () => {
      const world = instructionWorld();

      await world.book();

      expect(world.told(world.instructor.id)).toEqual([
        expect.objectContaining({
          notification_type: 'INSTRUCTION_BOOKED',
          message:
            'Instruction flight with John Student on aircraft F-ABCD, on 12 January 2027, 10:00: you are its instructor.',
        }),
      ]);
      const mail = world.mailer.sendMail.mock.calls.find(
        ([to]) => to === 'irene@test.com',
      );
      expect(mail[1]).toBe('New instruction flight');
      expect(mail[3]).toBe('instruction-booking');
      expect(mail[5]).toBe('en');
      // The student still gets their own confirmation.
      expect(
        world.told(world.student.id).map((n) => n.notification_type),
      ).toEqual(['RESERVATION_CONFIRMED', 'WITHDRAWAL']);
    });

    it('tells the instructor of a change and of a cancellation', async () => {
      const world = instructionWorld();
      const booking = await world.book();
      world.notifications.create.mockClear();
      world.mailer.sendMail.mockClear();

      await world.reservations.update(
        { id: booking.id, purpose: 'Tours de piste' } as any,
        NOW,
      );
      await world.reservations.delete(booking.id, { isAdmin: false }, NOW);

      expect(
        world.told(world.instructor.id).map((n) => n.notification_type),
      ).toEqual(['INSTRUCTION_CHANGED', 'INSTRUCTION_CANCELLED']);
      expect(
        world.mailer.sendMail.mock.calls
          .filter(([to]) => to === 'irene@test.com')
          .map(([, subject]) => subject),
      ).toEqual(['Instruction flight changed', 'Instruction flight cancelled']);
    });

    it('says nothing to an instructor when the booking has none', async () => {
      const world = instructionWorld({ licensed: true });

      await world.book({ instructor_id: null });

      expect(world.told(world.instructor.id)).toEqual([]);
    });
  });

  describe('declining', () => {
    it('lets the instructor cancel before the start: the student is refunded what they paid', async () => {
      const world = instructionWorld();
      const booking = await world.book();
      world.notifications.create.mockClear();
      // The rate has changed since: the refund is what was charged.
      world.database.rows(tables.Aircraft)[0].hourly_cost = 300;

      await world.reservations.delete(
        booking.id,
        { isAdmin: false, userId: world.instructor.id },
        NOW,
      );

      expect(world.balance()).toBe(500);
      expect(world.paymentLines()).toEqual([
        'booking:150.00',
        'booking_refund:150.00',
      ]);
      expect(world.database.rows(tables.Reservation)).toHaveLength(0);
      // The student is told who cancelled.
      expect(
        world
          .told(world.student.id)
          .find((n) => n.notification_type === 'RESERVATION_CANCELLED').message,
      ).toBe(
        "Votre instructeur Irene Morel a annulé le vol d'instruction du 12 janvier 2027, 10:00 sur l'avion F-ABCD. Ce que vous aviez payé vous est remboursé.",
      );
    });

    it('refuses the instructor once the booking has started, like its holder', async () => {
      const world = instructionWorld();
      const booking = await world.book();

      expect(
        await refusal(
          world.reservations.delete(
            booking.id,
            { isAdmin: false, userId: world.instructor.id },
            new Date(SLOT.start_time.getTime() + 60 * 1000),
          ),
        ),
      ).toBe('error.reservation.cancelAfterStart');
      expect(world.balance()).toBe(350);
    });
  });

  describe('changing the instructor', () => {
    const colleagueOf = (world: ReturnType<typeof instructionWorld>) =>
      world.database.insert(tables.User, {
        first_name: 'Luc',
        last_name: 'Petit',
        email: 'luc@test.com',
        language: 'fr',
        role: { role_name: 'Instructeur' },
        licenses: [{ ...VALID_LICENCE }],
      });

    it('refuses to take the instructor off a student’s booking', async () => {
      const world = instructionWorld();
      const booking = await world.book();

      expect(
        await refusal(
          world.reservations.update(
            { id: booking.id, instructor_id: null } as any,
            NOW,
          ),
        ),
      ).toBe('error.reservation.instructorRequired');
      expect(world.database.rows(tables.Reservation)[0].instructor).toEqual({
        id: world.instructor.id,
      });
    });

    it('keeps the instructor when the change does not mention one', async () => {
      const world = instructionWorld();
      const booking = await world.book();

      const changed = await world.reservations.update(
        {
          id: booking.id,
          flight_category: FlightCategory.LOCAL,
          purpose: 'Navigation',
        } as any,
        NOW,
      );

      expect(changed.instructor.id).toBe(world.instructor.id);
      // Still an instruction flight, whatever category is sent.
      expect(changed.flight_category).toBe(FlightCategory.INSTRUCTION);
    });

    it('hands the flight to another instructor: one is told it is off, the other it is on, no money moves', async () => {
      const world = instructionWorld();
      const colleague = colleagueOf(world);
      const booking = await world.book();
      world.notifications.create.mockClear();

      const changed = await world.reservations.update(
        { id: booking.id, instructor_id: colleague.id } as any,
        NOW,
      );

      expect(changed.instructor.id).toBe(colleague.id);
      expect(
        world.told(world.instructor.id).map((n) => n.notification_type),
      ).toEqual(['INSTRUCTION_CANCELLED']);
      expect(world.told(colleague.id).map((n) => n.notification_type)).toEqual([
        'INSTRUCTION_BOOKED',
      ]);
      expect(world.balance()).toBe(350);
      expect(world.paymentLines()).toEqual(['booking:150.00']);
    });

    it('checks the new instructor like on a new booking', async () => {
      const world = instructionWorld();
      const colleague = colleagueOf(world);
      const booking = await world.book();
      // The colleague flies their own aircraft at that time.
      await world.reservations.create(
        world.input({
          user_id: colleague.id,
          aircraft_id: world.otherAircraft.id,
        }),
        NOW,
      );

      expect(
        await refusal(
          world.reservations.update(
            { id: booking.id, instructor_id: colleague.id } as any,
            NOW,
          ),
        ),
      ).toBe('error.reservation.instructorAlreadyBooked');
    });

    it('does not see the booking being moved as a conflict for its own instructor', async () => {
      const world = instructionWorld();
      const booking = await world.book();

      const moved = await world.reservations.update(
        { id: booking.id, ...later(0.5) } as any,
        NOW,
      );

      expect(moved.start_time).toEqual(later(0.5).start_time);
    });
  });

  describe('a booking made for a course', () => {
    const withCourse = (overrides: object = {}) => {
      const world = instructionWorld();
      const course = world.database.insert(tables.InstructionCourse, {
        instructor: { id: world.instructor.id },
        student: { id: world.student.id },
        startTime: SLOT.start_time,
        endTime: SLOT.end_time,
        status: 'SCHEDULED',
        reservation: null,
        ...overrides,
      });
      const asInstructor = {
        id: world.instructor.id,
        email: 'irene@test.com',
        role: { role_name: 'Instructeur' },
      };
      // What the resolver sends for a member: their own id as the pilot.
      const bookFor = (requester: any, more: object = {}) =>
        world.reservations.create(
          world.input({
            user_id: requester.id,
            course_id: course.id,
            ...more,
          }),
          NOW,
          requester,
        );
      return { world, course, asInstructor, bookFor };
    };

    it('lets the instructor book the aircraft: the student flies, pays and is told', async () => {
      const { world, course, asInstructor, bookFor } = withCourse();

      const booking = await bookFor(asInstructor);

      expect(booking.user.id).toBe(world.student.id);
      expect(booking.instructor.id).toBe(world.instructor.id);
      expect(booking.flight_category).toBe(FlightCategory.INSTRUCTION);
      expect(world.balance()).toBe(350);
      expect(world.database.balanceOf(world.instructor.id)).toBe(0);
      expect(
        world.database.rows(tables.InstructionCourse)[0].reservation,
      ).toEqual({ id: booking.id });
      expect(course.id).toBeDefined();
      expect(
        world.told(world.student.id).map((n) => n.notification_type),
      ).toEqual(['RESERVATION_CONFIRMED', 'WITHDRAWAL']);
    });

    it('lets the student book it too, with the instructor of the course', async () => {
      const { world, bookFor } = withCourse();

      const booking = await bookFor(
        { id: world.student.id, email: 'john@test.com' },
        { instructor_id: 999 },
      );

      expect(booking.instructor.id).toBe(world.instructor.id);
    });

    it('refuses someone who is neither the student nor the instructor of the course', async () => {
      const { world, bookFor } = withCourse();
      const stranger = world.database.insert(tables.User, {
        first_name: 'Zoe',
        email: 'zoe@test.com',
        user_account_balance: 500,
        role: { role_name: 'Instructeur' },
        licenses: [{ ...VALID_LICENCE }],
      });

      expect(
        await refusal(
          bookFor({
            id: stranger.id,
            email: 'zoe@test.com',
            role: { role_name: 'Instructeur' },
          }),
        ),
      ).toBe('error.reservation.courseNotYours');
      expect(world.balance()).toBe(500);
    });

    it('refuses a course that is cancelled, already has an aircraft, or is at another time', async () => {
      const cancelled = withCourse({ status: 'CANCELED' });
      expect(await refusal(cancelled.bookFor(cancelled.asInstructor))).toBe(
        'error.reservation.courseNotScheduled',
      );

      const booked = withCourse();
      await booked.bookFor(booked.asInstructor);
      expect(
        await refusal(
          booked.bookFor(booked.asInstructor, {
            aircraft_id: booked.world.otherAircraft.id,
            ...later(0.5),
          }),
        ),
      ).toBe('error.reservation.courseAlreadyBooked');

      const elsewhere = withCourse();
      expect(
        await refusal(elsewhere.bookFor(elsewhere.asInstructor, later(4))),
      ).toBe('error.reservation.courseSlotMismatch');

      expect(
        await refusal(
          elsewhere.bookFor(elsewhere.asInstructor, { course_id: 999 }),
        ),
      ).toBe('error.reservation.courseNotFound');
    });

    it('keeps the course when its booking is cancelled: it has no aircraft any more', async () => {
      const { world, asInstructor, bookFor } = withCourse();
      const booking = await bookFor(asInstructor);

      await world.reservations.delete(booking.id, { isAdmin: false }, NOW);

      const [course] = world.database.rows(tables.InstructionCourse);
      expect(course.status).toBe('SCHEDULED');
      expect(course.reservation).toBeNull();
      expect(world.balance()).toBe(500);
    });
  });

  describe('what the booking form asks', () => {
    it('lists the active instructors only', async () => {
      const world = instructionWorld();
      world.database.insert(tables.User, {
        first_name: 'Gone',
        is_active: false,
        role: { role_name: 'Instructeur' },
      });

      const instructors = await world.reservations.findBookableInstructors();

      expect(instructors.map((user) => user.id)).toEqual([world.instructor.id]);
    });

    it('says whether a member may book without an instructor', async () => {
      const student = instructionWorld();
      const pilot = instructionWorld({ licensed: true });

      expect(
        await student.reservations.mayBookAlone(
          student.student.id,
          SLOT.end_time,
        ),
      ).toBe(false);
      expect(
        await pilot.reservations.mayBookAlone(pilot.student.id, SLOT.end_time),
      ).toBe(true);
      // The licence ends before the flight does.
      expect(
        await pilot.reservations.mayBookAlone(
          pilot.student.id,
          new Date('2028-06-01T00:00:00Z'),
        ),
      ).toBe(false);
    });
  });
});
