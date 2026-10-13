import { BadRequestException, ConflictException } from '@nestjs/common';
import { translationOf } from '../../../common/i18n/localized-exception';
import { tables } from '../../../../test/support/fake-database';
import { bookingWorld, NOW } from '../../../../test/support/booking-world';

describe('ReservationsService languages', () => {
  const englishWorld = () => {
    const world = bookingWorld();
    world.database.rows(tables.User)[0].language = 'en';
    return world;
  };

  it('confirms a booking in English to an English-speaking member', async () => {
    const world = englishWorld();

    await world.reservations.create(world.input(), NOW);

    expect(world.mailer.sendMail).toHaveBeenCalledWith(
      'john@test.com',
      'Your booking is confirmed',
      'Your booking for aircraft F-ABCD has been confirmed.',
      'reservation-confirmation',
      {
        name: 'John',
        aircraft_registration: 'F-ABCD',
        // Club time: the slot is 09:00-10:00 UTC.
        start_time: '12 January 2027, 10:00',
        end_time: '12 January 2027, 11:00',
      },
      'en',
    );
    expect(world.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        notification_type: 'RESERVATION_CONFIRMED',
        message: 'Your booking for aircraft F-ABCD has been confirmed.',
      }),
    );
  });

  it('keeps the French confirmation for a French-speaking member', async () => {
    const world = bookingWorld();

    await world.reservations.create(world.input(), NOW);

    expect(world.mailer.sendMail).toHaveBeenCalledWith(
      'john@test.com',
      'Confirmation de votre réservation',
      "Votre réservation pour l'avion F-ABCD a été confirmée.",
      'reservation-confirmation',
      expect.objectContaining({
        start_time: '12 janvier 2027, 10:00',
        end_time: '12 janvier 2027, 11:00',
      }),
      'fr',
    );
    expect(world.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Votre réservation pour l'avion F-ABCD a été confirmée.",
      }),
    );
  });

  it('announces a change and a cancellation in English', async () => {
    const world = englishWorld();
    const booking = await world.reservations.create(world.input(), NOW);
    world.mailer.sendMail.mockClear();
    world.notifications.create.mockClear();

    await world.reservations.update(
      { id: booking.id, notes: 'Changed' } as any,
      NOW,
    );
    await world.reservations.delete(booking.id, { isAdmin: false }, NOW);

    expect(
      world.mailer.sendMail.mock.calls.map((call) => [
        call[1],
        call[2],
        call[5],
      ]),
    ).toEqual([
      [
        'Your booking has been changed',
        'Your booking for aircraft F-ABCD has been changed.',
        'en',
      ],
      [
        'Your booking has been cancelled',
        'Your booking for aircraft F-ABCD has been cancelled.',
        'en',
      ],
    ]);
    expect(
      world.notifications.create.mock.calls
        .map(([notification]) => notification)
        .filter((notification) =>
          notification.notification_type.startsWith('RESERVATION_'),
        )
        .map((notification) => notification.message),
    ).toEqual([
      'Your booking for aircraft F-ABCD has been changed.',
      'Your booking for aircraft F-ABCD has been cancelled.',
    ]);
  });

  // The refusal is thrown in French and carries what is needed to answer in
  // the language of the request (see LocalizedExceptionFilter).
  it.each([
    [
      'slot taken',
      (world: ReturnType<typeof bookingWorld>) =>
        world.database.insert(tables.Reservation, {
          aircraft: { id: world.aircraft.id },
          user: { id: 99 },
          status: 'confirmed',
          start_time: world.input().start_time,
          end_time: world.input().end_time,
        }),
      ConflictException,
      'Cet avion est déjà réservé pour les dates spécifiées.',
      'error.reservation.aircraftAlreadyBooked',
    ],
    [
      'no valid licence',
      (world: ReturnType<typeof bookingWorld>) =>
        (world.database.rows(tables.User)[0].licenses = []),
      BadRequestException,
      "Vous n'avez pas de licence valide pour réserver cet avion",
      'error.reservation.noValidLicence',
    ],
    [
      'insufficient balance',
      (world: ReturnType<typeof bookingWorld>) =>
        (world.database.rows(tables.User)[0].user_account_balance = 10),
      BadRequestException,
      'Solde insuffisant pour réserver cet avion',
      'error.reservation.insufficientBalance',
    ],
  ])(
    'refuses a booking (%s) with a translatable message',
    async (_case, arrange, type, message, key) => {
      const world = englishWorld();
      arrange(world);

      const error = await world.reservations
        .create(world.input(), NOW)
        .catch((thrown) => thrown);

      expect(error).toBeInstanceOf(type);
      expect(error.message).toBe(message);
      expect(translationOf(error)?.key).toBe(key);
      expect(world.mailer.sendMail).not.toHaveBeenCalled();
    },
  );
});
