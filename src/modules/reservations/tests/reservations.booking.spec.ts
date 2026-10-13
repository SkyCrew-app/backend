import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { translationOf } from '../../../common/i18n/localized-exception';
import { FlightCategory } from '../entity/reservations.entity';
import { tables } from '../../../../test/support/fake-database';
import {
  bookingWorld,
  NOW,
  SLOT,
} from '../../../../test/support/booking-world';

const HOUR = 60 * 60 * 1000;
const refusal = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (caught) => caught,
  );
  return translationOf(error)?.key ?? error?.message ?? null;
};

describe('Bookings and money', () => {
  describe('creating a booking', () => {
    it('charges the price, stores it on the booking and links the lines', async () => {
      const world = bookingWorld({ balance: 500, rate: 150 });

      const booking = await world.reservations.create(world.input(), NOW);

      expect(booking.charged_amount).toBe(150);
      expect(world.balance()).toBe(350);
      const [line] = world.database.rows(tables.Payment);
      expect(line).toMatchObject({
        kind: 'booking',
        amount: 150,
        payment_status: 'completed',
        reservation_id: booking.id,
        user: { id: world.member.id },
      });
      // The invoice belongs to the member.
      expect(world.database.rows(tables.Invoice)[0].user).toEqual({
        id: world.member.id,
      });
    });

    it.each([
      [
        'an end before the start',
        { end_time: new Date(SLOT.start_time.getTime() - 24 * HOUR) },
        'error.reservation.endBeforeStart',
      ],
      [
        'no duration',
        { end_time: SLOT.start_time },
        'error.reservation.endBeforeStart',
      ],
      [
        'a few seconds',
        { end_time: new Date(SLOT.start_time.getTime() + 5000) },
        'error.reservation.tooShort',
      ],
      [
        'several days',
        { end_time: new Date(SLOT.start_time.getTime() + 72 * HOUR) },
        'error.reservation.tooLong',
      ],
      [
        'a start in the past',
        {
          start_time: new Date(NOW.getTime() - HOUR),
          end_time: new Date(NOW.getTime() + HOUR),
        },
        'error.reservation.inThePast',
      ],
    ])('refuses %s and moves no money', async (_case, overrides, key) => {
      const world = bookingWorld({ balance: 100 });

      expect(
        await refusal(world.reservations.create(world.input(overrides), NOW)),
      ).toBe(key);
      expect(world.balance()).toBe(100);
      expect(world.database.rows(tables.Reservation)).toHaveLength(0);
      expect(world.database.rows(tables.Payment)).toHaveLength(0);
    });

    it('rounds the price to cents once: charge, line and refund agree', async () => {
      const world = bookingWorld({ balance: 500, rate: 133.33 });

      // 1.5 h at 133.33 is 199.995.
      const booking = await world.reservations.create(
        world.input({
          end_time: new Date(SLOT.start_time.getTime() + 1.5 * HOUR),
        }),
        NOW,
      );
      expect(booking.charged_amount).toBe(200);
      expect(world.balance()).toBe(300);

      await world.reservations.delete(booking.id, { isAdmin: false }, NOW);
      expect(world.balance()).toBe(500);
      expect(world.paymentLines()).toEqual([
        'booking:200.00',
        'booking_refund:200.00',
      ]);
    });

    it('saves nothing when the member cannot pay', async () => {
      const world = bookingWorld({ balance: 100, rate: 150 });

      expect(await refusal(world.reservations.create(world.input(), NOW))).toBe(
        'error.reservation.insufficientBalance',
      );
      expect(world.database.rows(tables.Reservation)).toHaveLength(0);
      expect(world.balance()).toBe(100);
      expect(world.mailer.sendMail).not.toHaveBeenCalled();
    });

    it('undoes the charge and the booking when recording the payment fails', async () => {
      const world = bookingWorld({ balance: 500 });
      world.database.failNextSaveOf = tables.Payment;

      await expect(
        world.reservations.create(world.input(), NOW),
      ).rejects.toThrow('write failed');
      expect(world.balance()).toBe(500);
      expect(world.database.rows(tables.Reservation)).toHaveLength(0);
      expect(world.database.rows(tables.Invoice)).toHaveLength(0);
      expect(world.mailer.sendMail).not.toHaveBeenCalled();
    });

    it('lets one of two simultaneous bookings through when the balance covers one', async () => {
      const world = bookingWorld({ balance: 150, rate: 150 });

      const results = await Promise.allSettled([
        world.reservations.create(world.input(), NOW),
        world.reservations.create(
          world.input({
            aircraft_id: world.otherAircraft.id,
            start_time: new Date(SLOT.start_time.getTime() + 2 * HOUR),
            end_time: new Date(SLOT.end_time.getTime() + 2 * HOUR),
          }),
          NOW,
        ),
      ]);

      expect(results.map((result) => result.status).sort()).toEqual([
        'fulfilled',
        'rejected',
      ]);
      expect(world.balance()).toBe(0);
      expect(world.database.rows(tables.Reservation)).toHaveLength(1);
    });

    it('locks the aircraft and the pilot before checking anything', async () => {
      const world = bookingWorld();

      await world.reservations.create(world.input(), NOW);

      expect(world.database.locks).toEqual([
        `aircraft:${world.aircraft.id}`,
        `users:${world.member.id}`,
      ]);
    });

    it('answers "already booked" when the database refuses the slot', async () => {
      const world = bookingWorld();
      world.database.enforceSlotExclusion = true;
      // A booking the application check does not see (another server, a race).
      world.database.insert(tables.Reservation, {
        aircraft: { id: world.aircraft.id },
        user: { id: 99 },
        status: 'cancelled',
        ...SLOT,
      });

      const error = await world.reservations
        .create(world.input(), NOW)
        .catch((caught) => caught);

      expect(error).toBeInstanceOf(ConflictException);
      expect(translationOf(error).key).toBe(
        'error.reservation.aircraftAlreadyBooked',
      );
      expect(world.balance()).toBe(500);
    });

    it('writes the e-mail in club time', async () => {
      const world = bookingWorld();

      await world.reservations.create(world.input(), NOW);

      // 09:00 UTC is 10:00 at the club in January.
      expect(world.mailer.sendMail.mock.calls[0][4]).toMatchObject({
        start_time: '12 janvier 2027, 10:00',
        end_time: '12 janvier 2027, 11:00',
      });
    });
  });

  describe('the rules of a booking', () => {
    const book = (world: ReturnType<typeof bookingWorld>, overrides = {}) =>
      refusal(world.reservations.create(world.input(overrides), NOW));

    it('refuses an unknown aircraft and an unknown member', async () => {
      const world = bookingWorld();
      expect(await book(world, { aircraft_id: 999 })).toBe(
        'error.reservation.aircraftNotFound',
      );
      expect(await book(world, { user_id: 999 })).toBe(
        'error.reservation.userNotFound',
      );
    });

    it('refuses an aircraft that is unavailable', async () => {
      const world = bookingWorld();
      world.database.rows(tables.Aircraft)[0].availability_status =
        'UNAVAILABLE';
      expect(await book(world)).toBe('error.reservation.aircraftUnavailable');
    });

    it('refuses a slot over a planned maintenance, not over a finished one', async () => {
      const world = bookingWorld();
      const maintenance = world.database.insert(tables.Maintenance, {
        aircraft: { id: world.aircraft.id },
        start_date: new Date('2027-01-12T00:00:00Z'),
        end_date: new Date('2027-01-13T00:00:00Z'),
        status: 'PLANNED',
      });
      expect(await book(world)).toBe('error.reservation.aircraftInMaintenance');

      world.database.rows(tables.Maintenance)[0].status = 'COMPLETED';
      expect(maintenance.id).toBeDefined();
      expect(await book(world)).toBeNull();
    });

    // A maintenance "until the 12th" stores the 12th at midnight: the
    // aircraft is held through that day, as the maintenance screens say.
    it('refuses a slot on the last day of a maintenance, and accepts the day after', async () => {
      const world = bookingWorld();
      world.database.insert(tables.Maintenance, {
        aircraft: { id: world.aircraft.id },
        start_date: new Date('2027-01-10T00:00:00Z'),
        end_date: new Date('2027-01-12T00:00:00Z'),
        status: 'PLANNED',
      });

      expect(await book(world)).toBe('error.reservation.aircraftInMaintenance');
      expect(
        await book(world, {
          start_time: new Date(SLOT.start_time.getTime() + 24 * HOUR),
          end_time: new Date(SLOT.end_time.getTime() + 24 * HOUR),
        }),
      ).toBeNull();
    });

    it('refuses a booking for a deactivated member', async () => {
      const world = bookingWorld();
      world.database.rows(tables.User)[0].is_active = false;

      expect(await book(world)).toBe('error.reservation.memberInactive');
      expect(world.database.rows(tables.Reservation)).toHaveLength(0);
      expect(world.balance()).toBe(500);
    });

    it('refuses an aircraft already booked, and accepts the slot right after', async () => {
      const world = bookingWorld();
      await world.reservations.create(world.input(), NOW);
      const other = world.database.insert(tables.User, {
        first_name: 'Jane',
        email: 'jane@test.com',
        user_account_balance: 500,
        licenses: world.member.licenses,
      });

      expect(await book(world, { user_id: other.id })).toBe(
        'error.reservation.aircraftAlreadyBooked',
      );
      expect(
        await book(world, {
          user_id: other.id,
          start_time: SLOT.end_time,
          end_time: new Date(SLOT.end_time.getTime() + HOUR),
        }),
      ).toBeNull();
    });

    it('refuses the same pilot on two aircraft at once', async () => {
      const world = bookingWorld();
      await world.reservations.create(world.input(), NOW);

      expect(await book(world, { aircraft_id: world.otherAircraft.id })).toBe(
        'error.reservation.pilotAlreadyBooked',
      );
    });

    it('refuses a closure day, in French or in English in the settings', async () => {
      const world = bookingWorld();
      // Sunday 17 January 2027.
      const sunday = {
        start_time: new Date('2027-01-17T09:00:00Z'),
        end_time: new Date('2027-01-17T10:00:00Z'),
      };
      expect(await book(world, sunday)).toBe('error.reservation.clubClosedDay');

      world.settings.closureDays = ['Sunday'];
      expect(await book(world, sunday)).toBe('error.reservation.clubClosedDay');
    });

    it('refuses a slot outside the opening hours, read in club time', async () => {
      const world = bookingWorld();
      // 06:30 UTC is 07:30 at the club: before the 08:00 opening.
      expect(
        await book(world, {
          start_time: new Date('2027-01-12T06:30:00Z'),
          end_time: new Date('2027-01-12T08:00:00Z'),
        }),
      ).toBe('error.reservation.outsideOpeningHours');
      // Until closing time exactly is accepted.
      expect(
        await book(world, {
          start_time: new Date('2027-01-12T18:00:00Z'),
          end_time: new Date('2027-01-12T19:00:00Z'),
        }),
      ).toBeNull();
      // Past closing time is not.
      expect(
        await book(world, {
          aircraft_id: world.otherAircraft.id,
          start_time: new Date('2027-01-13T18:30:00Z'),
          end_time: new Date('2027-01-13T19:30:00Z'),
        }),
      ).toBe('error.reservation.outsideOpeningHours');
    });

    it.each([
      [
        'expired before the flight',
        { expiration_date: new Date('2027-01-01T00:00:00Z') },
      ],
      ['marked invalid', { is_valid: false }],
      ['marked expired', { status: 'expired' }],
      ['still pending', { status: 'pending' }],
      ['of a type the club does not accept', { license_type: 'ULM' }],
    ])('refuses a pilot whose licence is %s', async (_case, licence) => {
      const world = bookingWorld();
      Object.assign(world.database.rows(tables.User)[0].licenses[0], licence);

      // Alone, that is: with an instructor the licence is the instructor's.
      expect(await book(world)).toBe('error.reservation.instructorRequired');
      expect(world.balance()).toBe(500);
    });

    // The stop-gap rule ("a lesson scheduled that day") is gone: a member
    // without a licence books with an instructor, see
    // reservations.instruction.spec.ts.
    it('no longer lets a student book alone on a day with a lesson', async () => {
      const world = bookingWorld();
      world.database.rows(tables.User)[0].licenses = [];
      world.database.insert(tables.InstructionCourse, {
        student: { id: world.member.id },
        instructor: { id: 99 },
        startTime: new Date('2027-01-12T13:00:00Z'),
        status: 'SCHEDULED',
      });

      expect(
        await book(world, { flight_category: FlightCategory.INSTRUCTION }),
      ).toBe('error.reservation.instructorRequired');
    });

    it('answers a clear refusal when the club has no settings', async () => {
      const world = bookingWorld();
      world.reservations['administrationService'].findAll = async () => [];
      expect(await book(world)).toBe('error.reservation.noClubSettings');
    });
  });

  describe('changing a booking', () => {
    const booked = async (options = {}) => {
      const world = bookingWorld({ balance: 500, rate: 150, ...options });
      const booking = await world.reservations.create(world.input(), NOW);
      world.mailer.sendMail.mockClear();
      const change = (changes: object, now = NOW) =>
        world.reservations.update(
          {
            id: booking.id,
            flight_category: FlightCategory.LOCAL,
            ...changes,
          } as any,
          now,
        );
      return { world, booking, change };
    };

    it('charges the difference when the booking is made longer', async () => {
      const { world, change } = await booked();

      const updated = await change({
        end_time: new Date(SLOT.end_time.getTime() + 2 * HOUR),
      });

      expect(updated.charged_amount).toBe(450);
      expect(world.balance()).toBe(50);
      expect(world.paymentLines()).toEqual([
        'booking:150.00',
        'booking:300.00',
      ]);
    });

    it('refunds the difference when it is made shorter, then exactly the rest on cancellation', async () => {
      const { world, booking, change } = await booked();
      await change({ end_time: new Date(SLOT.end_time.getTime() + 2 * HOUR) });

      const updated = await change({ end_time: SLOT.end_time });
      expect(updated.charged_amount).toBe(150);
      expect(world.balance()).toBe(350);

      await world.reservations.delete(booking.id, { isAdmin: false }, NOW);
      expect(world.balance()).toBe(500);
    });

    it('refuses a longer booking the member cannot pay, and changes nothing', async () => {
      const { world, booking, change } = await booked({ balance: 200 });

      expect(
        await refusal(
          change({ end_time: new Date(SLOT.end_time.getTime() + 2 * HOUR) }),
        ),
      ).toBe('error.reservation.insufficientBalance');
      expect(world.balance()).toBe(50);
      expect(
        world.database.rows(tables.Reservation)[0].end_time.getTime(),
      ).toBe(new Date(booking.end_time).getTime());
    });

    it('moves no money when only the purpose changes, whatever the rate has become', async () => {
      const { world, change } = await booked();
      world.database.rows(tables.Aircraft)[0].hourly_cost = 300;

      const updated = await change({ purpose: 'Tour de piste', notes: 'RAS' });

      expect(updated.purpose).toBe('Tour de piste');
      expect(updated.charged_amount).toBe(150);
      expect(world.balance()).toBe(350);
    });

    it('goes through the same rules as a new booking', async () => {
      const { world, change } = await booked();
      const other = world.database.insert(tables.User, {
        first_name: 'Jane',
        email: 'jane@test.com',
        user_account_balance: 500,
        licenses: world.member.licenses,
      });
      await world.reservations.create(
        world.input({
          user_id: other.id,
          start_time: new Date(SLOT.start_time.getTime() + 2 * HOUR),
          end_time: new Date(SLOT.end_time.getTime() + 2 * HOUR),
        }),
        NOW,
      );

      // Onto another pilot's booking.
      expect(
        await refusal(
          change({ end_time: new Date(SLOT.end_time.getTime() + 2 * HOUR) }),
        ),
      ).toBe('error.reservation.aircraftAlreadyBooked');
      // Ending before it starts.
      expect(
        await refusal(
          change({ end_time: new Date(SLOT.start_time.getTime() - HOUR) }),
        ),
      ).toBe('error.reservation.endBeforeStart');
      // On a closure day.
      expect(
        await refusal(
          change({
            start_time: new Date('2027-01-17T09:00:00Z'),
            end_time: new Date('2027-01-17T10:00:00Z'),
          }),
        ),
      ).toBe('error.reservation.clubClosedDay');
      // With a licence that has since been withdrawn.
      world.database.rows(tables.User)[0].licenses[0].is_valid = false;
      expect(
        await refusal(
          change({ end_time: new Date(SLOT.end_time.getTime() + HOUR / 2) }),
        ),
      ).toBe('error.reservation.instructorRequired');
      expect(world.balance()).toBe(350);
    });

    it('moves the booking to another aircraft, at that aircraft’s price', async () => {
      const { world, change } = await booked();
      world.database.rows(tables.Aircraft)[1].hourly_cost = 200;

      const updated = await change({ aircraft_id: world.otherAircraft.id });

      expect(updated.aircraft.registration_number).toBe('F-WXYZ');
      expect(updated.charged_amount).toBe(200);
      expect(world.balance()).toBe(300);
      expect(world.mailer.sendMail.mock.calls[0][4]).toMatchObject({
        aircraft_registration: 'F-WXYZ',
      });
    });

    it('names the aircraft of the booking in the e-mail when none is sent', async () => {
      const { world, change } = await booked();
      // The booking is on the second aircraft of the table.
      world.database.rows(tables.Reservation)[0].aircraft = {
        id: world.otherAircraft.id,
      };

      await change({ notes: 'Nouvelle note' });

      expect(world.mailer.sendMail.mock.calls[0][2]).toContain('F-WXYZ');
      expect(world.mailer.sendMail.mock.calls[0][4]).toMatchObject({
        aircraft_registration: 'F-WXYZ',
      });
    });

    it('is refused once the booking has started, for everyone', async () => {
      const { change } = await booked();
      const error = await change(
        { notes: 'Trop tard' },
        new Date(SLOT.start_time.getTime() + 60 * 1000),
      ).catch((caught) => caught);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(translationOf(error).key).toBe('error.reservation.alreadyStarted');
    });

    it('refuses to hand the booking to another member', async () => {
      const { change } = await booked();
      expect(await refusal(change({ user_id: 42 }))).toBe(
        'error.reservation.holderCannotChange',
      );
    });

    it('refuses a new slot for an old booking whose price is unknown', async () => {
      const { world, change } = await booked();
      world.database.rows(tables.Reservation)[0].charged_amount = null;

      expect(
        await refusal(
          change({ end_time: new Date(SLOT.end_time.getTime() + HOUR) }),
        ),
      ).toBe('error.reservation.priceUnknown');
      expect(world.balance()).toBe(350);
    });

    it('answers not found for an unknown booking', async () => {
      const world = bookingWorld();
      const error = await world.reservations
        .update({ id: 404, flight_category: FlightCategory.LOCAL } as any, NOW)
        .catch((caught) => caught);
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.message).toBe('Réservation introuvable');
    });
  });

  describe('cancelling a booking', () => {
    const MEMBER = { isAdmin: false };
    const ADMIN = { isAdmin: true };
    const AFTER_START = new Date(SLOT.start_time.getTime() + 60 * 1000);

    const booked = async () => {
      const world = bookingWorld({ balance: 200, rate: 150 });
      const booking = await world.reservations.create(world.input(), NOW);
      return { world, booking };
    };

    it('refunds what was charged, not today’s rate', async () => {
      const { world, booking } = await booked();
      world.database.rows(tables.Aircraft)[0].hourly_cost = 180;

      await world.reservations.delete(booking.id, MEMBER, NOW);

      expect(world.balance()).toBe(200);
      expect(world.paymentLines()).toEqual([
        'booking:150.00',
        'booking_refund:150.00',
      ]);
      expect(world.database.rows(tables.Payment)[1].reservation_id).toBe(
        booking.id,
      );
      expect(world.database.rows(tables.Reservation)).toHaveLength(0);
    });

    it('cancels a booking that has a checklist, and refunds it once', async () => {
      const { world, booking } = await booked();
      world.database.checklistSubmissions.push({
        id: 1,
        reservationId: booking.id,
      });

      await world.reservations.delete(booking.id, MEMBER, NOW);
      expect(world.balance()).toBe(200);
      expect(world.database.rows(tables.Reservation)).toHaveLength(0);
      // The checklist is kept, without its booking.
      expect(world.database.checklistSubmissions).toEqual([
        { id: 1, reservationId: null },
      ]);

      const again = await world.reservations
        .delete(booking.id, MEMBER, NOW)
        .catch((caught) => caught);
      expect(again).toBeInstanceOf(NotFoundException);
      expect(world.balance()).toBe(200);
    });

    it('refunds nothing when the deletion fails', async () => {
      const { world, booking } = await booked();
      world.database.failNextDeleteOf = tables.Reservation;

      await expect(
        world.reservations.delete(booking.id, MEMBER, NOW),
      ).rejects.toThrow('delete failed');

      expect(world.balance()).toBe(50);
      expect(world.paymentLines()).toEqual(['booking:150.00']);
      expect(world.database.rows(tables.Reservation)).toHaveLength(1);
      expect(world.mailer.sendMail).toHaveBeenCalledTimes(1); // the confirmation
    });

    it('refunds once when two cancellations arrive together', async () => {
      const { world, booking } = await booked();

      const results = await Promise.allSettled([
        world.reservations.delete(booking.id, MEMBER, NOW),
        world.reservations.delete(booking.id, MEMBER, NOW),
      ]);

      expect(results.map((result) => result.status).sort()).toEqual([
        'fulfilled',
        'rejected',
      ]);
      expect(world.balance()).toBe(200);
      expect(world.database.locks).toContain(`reservations:${booking.id}`);
    });

    it('refunds nothing for a booking nothing was charged for', async () => {
      const { world, booking } = await booked();
      world.database.rows(tables.Reservation)[0].charged_amount = null;

      await world.reservations.delete(booking.id, MEMBER, NOW);

      expect(world.balance()).toBe(50);
      expect(world.paymentLines()).toEqual(['booking:150.00']);
    });

    it('is the member’s until the start time, an administrator’s afterwards', async () => {
      const { world, booking } = await booked();

      const error = await world.reservations
        .delete(booking.id, MEMBER, AFTER_START)
        .catch((caught) => caught);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(translationOf(error).key).toBe(
        'error.reservation.cancelAfterStart',
      );
      expect(world.balance()).toBe(50);

      await world.reservations.delete(booking.id, ADMIN, AFTER_START);
      expect(world.balance()).toBe(200);
    });

    it('treats a caller it knows nothing about as a member', async () => {
      const { world, booking } = await booked();
      world.database.rows(tables.Reservation)[0].start_time = new Date(
        Date.now() - HOUR,
      );
      expect(await refusal(world.reservations.delete(booking.id))).toBe(
        'error.reservation.cancelAfterStart',
      );
    });

    it('refuses the member once a flight was flown, closed or not', async () => {
      const { world, booking } = await booked();
      world.database.flights.push({ id: 5, reservationId: booking.id });

      // A flight plan before the start does not block the cancellation…
      expect(
        await refusal(
          world.reservations.delete(booking.id, MEMBER, AFTER_START),
        ),
      ).toBe('error.reservation.flightFlown');
      expect(world.balance()).toBe(50);
    });

    it('lets the member cancel before the start even with a flight plan', async () => {
      const { world, booking } = await booked();
      world.database.flights.push({ id: 5, reservationId: booking.id });

      await world.reservations.delete(booking.id, MEMBER, NOW);
      expect(world.balance()).toBe(200);
    });

    it('keeps a booking whose flight is closed, for everyone', async () => {
      const { world, booking } = await booked();
      world.database.flights.push({
        id: 5,
        reservationId: booking.id,
        closed_at: new Date(),
      });

      for (const actor of [MEMBER, ADMIN]) {
        const error = await world.reservations
          .delete(booking.id, actor, NOW)
          .catch((caught) => caught);
        expect(error).toBeInstanceOf(ConflictException);
        expect(error.message).toContain('clôturé');
      }
      expect(world.balance()).toBe(50);
      expect(world.database.rows(tables.Reservation)).toHaveLength(1);
    });

    it('still cancels when the e-mail cannot be sent', async () => {
      const { world, booking } = await booked();
      world.mailer.sendMail.mockRejectedValue(new Error('SMTP down'));

      await world.reservations.delete(booking.id, MEMBER, NOW);

      expect(world.balance()).toBe(200);
      expect(world.database.rows(tables.Reservation)).toHaveLength(0);
    });
  });

  it('never accepts a non-positive charge', async () => {
    const world = bookingWorld({ balance: 100 });
    for (const cents of [0, -15000, 1.5, NaN]) {
      const error = await world.payments
        .chargeBooking(world.database.manager, {
          userId: world.member.id,
          cents,
        })
        .catch((caught) => caught);
      expect(error).toBeInstanceOf(BadRequestException);
    }
    expect(world.balance()).toBe(100);
  });
});
