import { CronService } from '../cron.service';
import { ReservationStatus } from '../../reservations/entity/reservations.entity';

describe('CronService reminders in the language of the member', () => {
  let service: CronService;
  let courses: { findExpiredCourses: jest.Mock; updateCourseStatus: jest.Mock };
  let licences: { findExpiringLicenses: jest.Mock; update: jest.Mock };
  let notifications: { create: jest.Mock; alreadySent: jest.Mock };
  let reservations: {
    findReservationsBetween: jest.Mock;
    findFinishedReservations: jest.Mock;
  };

  const messages = () =>
    notifications.create.mock.calls.map(([notification]) => [
      notification.notification_type,
      notification.message,
    ]);

  beforeEach(() => {
    courses = { findExpiredCourses: jest.fn(), updateCourseStatus: jest.fn() };
    licences = { findExpiringLicenses: jest.fn(), update: jest.fn() };
    notifications = {
      create: jest.fn(),
      alreadySent: jest.fn().mockResolvedValue(false),
    };
    reservations = {
      findReservationsBetween: jest.fn(),
      findFinishedReservations: jest.fn(),
    };
    service = new CronService(
      courses as any,
      licences as any,
      notifications as any,
      reservations as any,
      {} as any,
      { sendExpiryReminders: jest.fn().mockResolvedValue(0) } as any,
    );
  });

  const tomorrowReservations = (language?: string) => [
    { id: 5, status: ReservationStatus.PENDING, user: { id: 1, language } },
    {
      id: 6,
      status: ReservationStatus.CONFIRMED,
      user: { id: 1, language },
      flights: [],
      number_of_passengers: null,
    },
    {
      id: 7,
      status: ReservationStatus.CONFIRMED,
      user: { id: 1, language },
      flights: [{ encoded_polyline: null, waypoints: null }],
      number_of_passengers: 2,
    },
  ];

  // The passenger-count reminder used to be listed here: members were asked
  // every night for a value no screen lets them enter.
  it('keeps the French wording for a French-speaking member', async () => {
    reservations.findReservationsBetween.mockResolvedValue(
      tomorrowReservations(),
    );

    await service.handleReservationNotifications();

    expect(messages()).toEqual([
      [
        'RESERVATION_PENDING',
        "Votre réservation N°5 n'est pas confirmée. Veuillez la confirmer.",
      ],
      [
        'MISSING_FLIGHT_PLAN',
        "Votre vol prévu demain pour la réservation N°6 n'a pas de plan de vol. Veuillez le soumettre.",
      ],
      [
        'INCOMPLETE_FLIGHT_PLAN',
        'Votre vol prévu demain pour la réservation N°7 a un plan de vol incomplet. Veuillez le compléter.',
      ],
    ]);
  });

  it("writes tomorrow's reminders in English to an English-speaking member", async () => {
    reservations.findReservationsBetween.mockResolvedValue(
      tomorrowReservations('en'),
    );

    await service.handleReservationNotifications();

    expect(messages()).toEqual([
      [
        'RESERVATION_PENDING',
        'Your booking no. 5 is not confirmed. Please confirm it.',
      ],
      [
        'MISSING_FLIGHT_PLAN',
        'Your flight tomorrow for booking no. 6 has no flight plan. Please submit one.',
      ],
      [
        'INCOMPLETE_FLIGHT_PLAN',
        'Your flight tomorrow for booking no. 7 has an incomplete flight plan. Please complete it.',
      ],
    ]);
  });

  // The reminders before expiry used to be checked here too; they are now
  // sent by LicenceRemindersService (licence-reminders.spec.ts checks their
  // language). The nightly job itself still announces an expired licence.
  it('tells the holder of an expired licence in their language', async () => {
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    licences.findExpiringLicenses.mockResolvedValue([
      {
        id: 1,
        user: { id: 1, language: 'en' },
        license_type: 'PPL',
        expiration_date: soon,
        status: 'active',
      },
      {
        id: 2,
        user: { id: 2, language: 'en' },
        license_type: 'CPL',
        expiration_date: past,
        status: 'active',
      },
      {
        id: 3,
        user: { id: 3, language: 'fr' },
        license_type: 'PPL',
        expiration_date: past,
        status: 'active',
      },
    ]);

    await service.handleLicenseExpiration();

    expect(messages()).toEqual([
      ['LICENSE_EXPIRED', 'Your CPL licence has expired.'],
      ['LICENSE_EXPIRED', 'Votre licence PPL est expirée.'],
    ]);
  });

  it('writes the end of a course to the student and to the instructor, each in their language', async () => {
    courses.findExpiredCourses.mockResolvedValue([
      { id: 4, student: { id: 10 }, instructor: { id: 20, language: 'en' } },
    ]);

    await service.handleCourseStatusUpdate();

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 20,
        notification_type: 'COURSE_COMPLETED',
        message: 'Your course 4 is complete.',
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 10,
        notification_type: 'COURSE_COMPLETED',
        message: 'Votre cours 4 est terminé.',
      }),
    );
  });

  describe('reservation finished', () => {
    const french =
      'Votre réservation N°7 est terminée. Veuillez clôturer votre vol.';
    const english = 'Your booking no. 7 has ended. Please close the flight.';
    // Ended an hour ago, with a flight still to close.
    const unclosed = {
      end_time: new Date(Date.now() - 3_600_000),
      flights: [{ id: 1 }],
    };

    it.each([
      [undefined, french],
      ['fr', french],
      ['en', english],
    ])('reminds a member whose language is %s', async (language, expected) => {
      reservations.findFinishedReservations.mockResolvedValue([
        { id: 7, user: { id: 70, language }, ...unclosed },
      ]);

      await service.notificationFinishReservation();

      expect(messages()).toEqual([['RESERVATION_FINISHED', expected]]);
    });

    it('recognises a reminder already sent in the other language', async () => {
      reservations.findFinishedReservations.mockResolvedValue([
        { id: 7, user: { id: 70, language: 'en' }, ...unclosed },
      ]);
      // Sent in French before the member switched to English.
      notifications.alreadySent.mockImplementation(
        async (_userId, _type, sent: string[]) => sent.includes(french),
      );

      await service.notificationFinishReservation();

      expect(notifications.alreadySent).toHaveBeenCalledWith(
        70,
        'RESERVATION_FINISHED',
        [french, english],
      );
      expect(notifications.create).not.toHaveBeenCalled();
    });
  });
});
