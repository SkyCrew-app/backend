import { BadRequestException, ConflictException } from '@nestjs/common';
import { translationOf } from '../../../common/i18n/localized-exception';
import { ReservationsService } from '../reservations.service';

describe('ReservationsService languages', () => {
  let service: ReservationsService;
  let reservationRepository: any;
  let userRepository: any;
  let aircraftRepository: any;
  let mailer: { sendMail: jest.Mock };
  let administration: { findAll: jest.Mock };
  let payments: { createWithdrawal: jest.Mock; refund: jest.Mock };
  let notifications: { create: jest.Mock };

  const aircraft = { id: 1, registration_number: 'F-ABCD', hourly_cost: 150 };
  const member = (overrides: object = {}) => ({
    id: 1,
    first_name: 'John',
    email: 'john@test.com',
    language: 'en',
    user_account_balance: 500,
    licenses: [{ license_type: 'PPL' }],
    ...overrides,
  });
  const input = {
    aircraft_id: 1,
    user_id: 1,
    start_time: new Date(2026, 5, 1, 8, 0),
    end_time: new Date(2026, 5, 1, 10, 0),
  } as any;

  beforeEach(() => {
    reservationRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((reservation) => reservation),
      save: jest.fn().mockImplementation(async (reservation) => reservation),
      remove: jest.fn(),
    };
    userRepository = {
      findOne: jest.fn().mockResolvedValue(member()),
      save: jest.fn(),
    };
    aircraftRepository = { findOne: jest.fn().mockResolvedValue(aircraft) };
    mailer = { sendMail: jest.fn().mockResolvedValue(true) };
    administration = {
      findAll: jest.fn().mockResolvedValue([{ pilotLicenses: ['PPL'] }]),
    };
    payments = { createWithdrawal: jest.fn(), refund: jest.fn() };
    notifications = { create: jest.fn() };
    service = new ReservationsService(
      reservationRepository,
      {} as any,
      mailer as any,
      userRepository,
      aircraftRepository,
      administration as any,
      payments as any,
      notifications as any,
    );
  });

  it('confirms a booking in English to an English-speaking member', async () => {
    await service.create(input);

    expect(mailer.sendMail).toHaveBeenCalledWith(
      'john@test.com',
      'Your booking is confirmed',
      'Your booking for aircraft F-ABCD has been confirmed.',
      'reservation-confirmation',
      {
        name: 'John',
        aircraft_registration: 'F-ABCD',
        start_time: '1 June 2026, 08:00',
        end_time: '1 June 2026, 10:00',
      },
      'en',
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        notification_type: 'RESERVATION_CONFIRMED',
        message: 'Your booking for aircraft F-ABCD has been confirmed.',
      }),
    );
  });

  it('keeps the French confirmation for a French-speaking member', async () => {
    userRepository.findOne.mockResolvedValue(member({ language: 'fr' }));

    await service.create(input);

    expect(mailer.sendMail).toHaveBeenCalledWith(
      'john@test.com',
      'Confirmation de votre réservation',
      "Votre réservation pour l'avion F-ABCD a été confirmée.",
      'reservation-confirmation',
      expect.objectContaining({
        start_time: '1 juin 2026, 08:00',
        end_time: '1 juin 2026, 10:00',
      }),
      'fr',
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Votre réservation pour l'avion F-ABCD a été confirmée.",
      }),
    );
  });

  it('announces a change and a cancellation in English', async () => {
    reservationRepository.findOne.mockResolvedValue({
      id: 9,
      user: { id: 1 },
      aircraft: { id: 1 },
      start_time: input.start_time,
      end_time: input.end_time,
    });
    payments.refund.mockResolvedValue({});

    await service.update({ id: 9, aircraft_id: 1 } as any);
    await service.delete(9);

    expect(
      mailer.sendMail.mock.calls.map((call) => [call[1], call[2], call[5]]),
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
      notifications.create.mock.calls.map(
        ([notification]) => notification.message,
      ),
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
      () => reservationRepository.find.mockResolvedValue([{ id: 2 }]),
      ConflictException,
      'Cet avion est déjà réservé pour les dates spécifiées.',
      'error.reservation.aircraftAlreadyBooked',
    ],
    [
      'no valid licence',
      () => userRepository.findOne.mockResolvedValue(member({ licenses: [] })),
      BadRequestException,
      "Vous n'avez pas de licence valide pour réserver cet avion",
      'error.reservation.noValidLicence',
    ],
    [
      'insufficient balance',
      () =>
        userRepository.findOne.mockResolvedValue(
          member({ user_account_balance: 10 }),
        ),
      BadRequestException,
      'Solde insuffisant pour réserver cet avion',
      'error.reservation.insufficientBalance',
    ],
  ])(
    'refuses a booking (%s) with a translatable message',
    async (_case, arrange, type, message, key) => {
      arrange();

      const error = await service.create(input).catch((thrown) => thrown);

      expect(error).toBeInstanceOf(type);
      expect(error.message).toBe(message);
      expect(translationOf(error)?.key).toBe(key);
      expect(mailer.sendMail).not.toHaveBeenCalled();
    },
  );
});
