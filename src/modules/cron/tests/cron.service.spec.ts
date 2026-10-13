import { Test, TestingModule } from '@nestjs/testing';
import { CronService } from '../cron.service';
import { InstructionCoursesService } from '../../instruction-courses/instruction-courses.service';
import { LicensesService } from '../../licenses/licenses.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ReservationsService } from '../../reservations/reservations.service';
import { FinancialService } from '../../financial/financial.service';
import { ReservationStatus } from '../../reservations/entity/reservations.entity';

describe('CronService', () => {
  let service: CronService;
  let courseService: Partial<InstructionCoursesService>;
  let licensesService: Partial<LicensesService>;
  let notificationsService: Partial<NotificationsService>;
  let reservationsService: Partial<ReservationsService>;
  let financialService: Partial<FinancialService>;

  beforeEach(async () => {
    courseService = {
      findExpiredCourses: jest.fn(),
      updateCourseStatus: jest.fn(),
    };
    licensesService = {
      findExpiringLicenses: jest.fn(),
      update: jest.fn(),
    };
    notificationsService = {
      create: jest.fn(),
      alreadySent: jest.fn().mockResolvedValue(false),
    };
    reservationsService = {
      findReservationsBetween: jest.fn(),
      findFinishedReservations: jest.fn(),
    };
    financialService = {
      aggregateRevenuesForPeriod: jest.fn(),
      aggregateExpensesForPeriod: jest.fn(),
      createFinancialReport: jest.fn(),
      updateFinancialReport: jest.fn(),
      findAllFinancialReports: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronService,
        { provide: InstructionCoursesService, useValue: courseService },
        { provide: LicensesService, useValue: licensesService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: ReservationsService, useValue: reservationsService },
        { provide: FinancialService, useValue: financialService },
      ],
    }).compile();

    service = module.get<CronService>(CronService);
  });

  describe('handleCourseStatusUpdate', () => {
    it('should update expired courses and send notifications', async () => {
      const courses = [
        { id: 1, student: { id: 10 }, instructor: { id: 20 } } as any,
      ];
      (courseService.findExpiredCourses as jest.Mock).mockResolvedValue(
        courses,
      );

      await service.handleCourseStatusUpdate();

      expect(courseService.updateCourseStatus).toHaveBeenCalledWith(
        1,
        'COMPLETED',
      );
      // The student and the instructor are both told.
      for (const userId of [10, 20]) {
        expect(notificationsService.create as jest.Mock).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: userId,
            notification_type: 'COURSE_COMPLETED',
            message: `Votre cours 1 est terminé.`,
          }),
        );
      }
    });

    it('goes on with the other courses when one fails', async () => {
      (courseService.findExpiredCourses as jest.Mock).mockResolvedValue([
        // No participants loaded: nobody to notify, not a reason to stop.
        { id: 1 },
        { id: 2, student: { id: 10 }, instructor: { id: 20 } },
        { id: 3, student: { id: 11 }, instructor: { id: 20 } },
      ]);
      (courseService.updateCourseStatus as jest.Mock).mockImplementation(
        async (id) => {
          if (id === 2) throw new Error('boom');
        },
      );

      await service.handleCourseStatusUpdate();

      expect(courseService.updateCourseStatus).toHaveBeenCalledTimes(3);
      expect(notificationsService.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 11 }),
      );
    });
  });

  describe('handleLicenseExpiration', () => {
    it('should mark expired licenses and notify', async () => {
      const licenses = [
        {
          id: 2,
          user: { id: 30 },
          expiration_date: new Date(0),
          status: 'active',
          license_type: 'PPL',
        } as any,
      ];
      (licensesService.findExpiringLicenses as jest.Mock).mockResolvedValue(
        licenses,
      );

      await service.handleLicenseExpiration();

      // An expired licence is no longer valid either.
      expect(licensesService.update as jest.Mock).toHaveBeenCalledWith({
        id: 2,
        status: 'expired',
        is_valid: false,
      });
      expect(notificationsService.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_type: 'LICENSE_EXPIRED',
          message: `Votre licence PPL est expirée.`,
        }),
      );
    });

    it('should notify licenses expiring soon', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const licenses = [
        {
          id: 3,
          user: { id: 40 },
          expiration_date: futureDate,
          license_type: 'CPL',
        } as any,
      ];
      (licensesService.findExpiringLicenses as jest.Mock).mockResolvedValue(
        licenses,
      );

      await service.handleLicenseExpiration();

      expect(notificationsService.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_type: 'LICENSE_EXPIRING_SOON',
          message: expect.stringContaining(
            'Votre licence CPL expirera bientôt',
          ),
        }),
      );
    });
  });

  describe('handleLicenseExpiration, night after night', () => {
    it('reminds once for an expiry date, not every night', async () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 3_600_000);
      (licensesService.findExpiringLicenses as jest.Mock).mockResolvedValue([
        {
          id: 3,
          user: { id: 40 },
          expiration_date: futureDate,
          license_type: 'CPL',
        },
      ]);
      (notificationsService.alreadySent as jest.Mock).mockResolvedValue(true);

      await service.handleLicenseExpiration();

      expect(notificationsService.alreadySent).toHaveBeenCalledWith(
        40,
        'LICENSE_EXPIRING_SOON',
        expect.arrayContaining([
          expect.stringContaining('Votre licence CPL expirera bientôt'),
        ]),
      );
      expect(notificationsService.create as jest.Mock).not.toHaveBeenCalled();
    });
  });

  describe('handleReservationNotifications', () => {
    it('should notify pending reservations', async () => {
      const reservations = [
        {
          id: 5,
          user: { id: 50 },
          status: ReservationStatus.PENDING,
          flights: [],
        } as any,
      ];
      (
        reservationsService.findReservationsBetween as jest.Mock
      ).mockResolvedValue(reservations);

      await service.handleReservationNotifications();

      expect(notificationsService.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_type: 'RESERVATION_PENDING',
          message: expect.stringContaining('réservation N°5'),
        }),
      );
    });

    // This test used to expect a MISSING_PASSENGER_COUNT reminder: the
    // number of passengers cannot be entered when booking, so every member
    // was asked for it every night.
    it('should notify an incomplete flight plan, and nothing about passengers', async () => {
      const reservation = {
        id: 6,
        user: { id: 60 },
        status: ReservationStatus.CONFIRMED,
        flights: [{ encoded_polyline: null, waypoints: null }],
        number_of_passengers: null,
      } as any;
      (
        reservationsService.findReservationsBetween as jest.Mock
      ).mockResolvedValue([reservation]);

      await service.handleReservationNotifications();

      expect(notificationsService.create as jest.Mock).toHaveBeenCalledTimes(1);
      expect(notificationsService.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_type: 'INCOMPLETE_FLIGHT_PLAN',
        }),
      );
    });

    it('does not repeat a flight plan reminder already sent for the booking', async () => {
      (
        reservationsService.findReservationsBetween as jest.Mock
      ).mockResolvedValue([
        {
          id: 6,
          user: { id: 60 },
          status: ReservationStatus.CONFIRMED,
          flights: [],
        },
      ]);
      (notificationsService.alreadySent as jest.Mock).mockResolvedValue(true);

      await service.handleReservationNotifications();

      expect(notificationsService.alreadySent).toHaveBeenCalledWith(
        60,
        'MISSING_FLIGHT_PLAN',
        expect.arrayContaining([expect.stringContaining('réservation N°6')]),
      );
      expect(notificationsService.create as jest.Mock).not.toHaveBeenCalled();
    });
  });

  describe('deactivated members', () => {
    const gone = { id: 90, is_active: false };

    it('are not reminded of anything, and their data is left alone', async () => {
      (courseService.findExpiredCourses as jest.Mock).mockResolvedValue([
        { id: 1, student: gone, instructor: { id: 20 } },
      ]);
      (licensesService.findExpiringLicenses as jest.Mock).mockResolvedValue([
        {
          id: 2,
          user: gone,
          license_type: 'PPL',
          status: 'active',
          expiration_date: new Date(Date.now() - 86_400_000),
        },
        {
          id: 3,
          user: gone,
          license_type: 'LAPL',
          status: 'active',
          expiration_date: new Date(Date.now() + 86_400_000),
        },
      ]);
      (
        reservationsService.findReservationsBetween as jest.Mock
      ).mockResolvedValue([
        { id: 5, user: gone, status: ReservationStatus.PENDING, flights: [] },
        { id: 6, user: gone, status: ReservationStatus.CONFIRMED, flights: [] },
      ]);
      (
        reservationsService.findFinishedReservations as jest.Mock
      ).mockResolvedValue([
        {
          id: 7,
          user: gone,
          end_time: new Date(Date.now() - 3_600_000),
          flights: [{ id: 1 }],
        },
      ]);

      await service.handleCourseStatusUpdate();
      await service.handleLicenseExpiration();
      await service.handleReservationNotifications();
      await service.notificationFinishReservation();

      const told = (notificationsService.create as jest.Mock).mock.calls.map(
        ([notification]) => notification.user_id,
      );
      // Only the instructor of the finished course, who is still a member.
      expect(told).toEqual([20]);
      // The course is still completed and the licence still marked expired.
      expect(courseService.updateCourseStatus).toHaveBeenCalledWith(
        1,
        'COMPLETED',
      );
      expect(licensesService.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2, status: 'expired' }),
      );
    });
  });

  describe('generateMonthlyFinancialReport', () => {
    beforeEach(() => {
      (
        financialService.aggregateRevenuesForPeriod as jest.Mock
      ).mockResolvedValue(1000);
      (
        financialService.aggregateExpensesForPeriod as jest.Mock
      ).mockResolvedValue(400);
    });

    it('should aggregate and create report', async () => {
      await service.generateMonthlyFinancialReport();

      expect(
        financialService.createFinancialReport as jest.Mock,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          total_revenue: 1000,
          total_expense: 400,
          net_profit: 600,
        }),
      );
    });

    it('reports the month that just ended, to its last instant', async () => {
      // Run on the 1st of November, shortly after midnight.
      await service.generateMonthlyFinancialReport(new Date(2026, 10, 1, 0, 0));

      const start = new Date(2026, 9, 1);
      const end = new Date(new Date(2026, 10, 1).getTime() - 1);
      expect(financialService.aggregateRevenuesForPeriod).toHaveBeenCalledWith(
        start,
        end,
      );
      expect(financialService.aggregateExpensesForPeriod).toHaveBeenCalledWith(
        start,
        end,
      );
      // The 31st is inside the period.
      expect(end.getDate()).toBe(31);
      expect(financialService.createFinancialReport).toHaveBeenCalledWith(
        expect.objectContaining({ report_date: start }),
      );
    });

    it('goes back to December when run in January', async () => {
      await service.generateMonthlyFinancialReport(new Date(2027, 0, 1));

      expect(financialService.createFinancialReport).toHaveBeenCalledWith(
        expect.objectContaining({ report_date: new Date(2026, 11, 1) }),
      );
    });

    it('refreshes the report of a month instead of adding a second one', async () => {
      (financialService.findAllFinancialReports as jest.Mock).mockResolvedValue(
        [
          { id: 3, report_date: new Date(2026, 8, 1) },
          { id: 4, report_date: new Date(2026, 9, 1) },
        ],
      );

      await service.generateMonthlyFinancialReport(new Date(2026, 10, 1));

      expect(financialService.createFinancialReport).not.toHaveBeenCalled();
      expect(financialService.updateFinancialReport).toHaveBeenCalledWith({
        id: 4,
        total_revenue: 1000,
        total_expense: 400,
        net_profit: 600,
      });
    });
  });

  describe('notificationFinishReservation', () => {
    // Ended an hour ago, with a flight plan that is still open.
    const finished = (overrides: object = {}) =>
      ({
        id: 7,
        user: { id: 70 },
        end_time: new Date(Date.now() - 3_600_000),
        flights: [{ id: 1 }],
        ...overrides,
      }) as any;

    beforeEach(() => {
      (notificationsService.create as jest.Mock).mockClear();
      (notificationsService as any).alreadySent = jest
        .fn()
        .mockResolvedValue(false);
    });

    it('should notify finished reservations', async () => {
      (
        reservationsService.findFinishedReservations as jest.Mock
      ).mockResolvedValue([finished()]);

      await service.notificationFinishReservation();

      expect(notificationsService.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_type: 'RESERVATION_FINISHED',
          message: expect.stringContaining('réservation N°7'),
        }),
      );
    });

    it('should not notify twice for the same reservation', async () => {
      (
        reservationsService.findFinishedReservations as jest.Mock
      ).mockResolvedValue([finished()]);
      (notificationsService as any).alreadySent.mockResolvedValue(true);

      await service.notificationFinishReservation();

      expect(notificationsService.create as jest.Mock).not.toHaveBeenCalled();
    });

    it('asks nothing for a booking that never had a flight plan', async () => {
      (
        reservationsService.findFinishedReservations as jest.Mock
      ).mockResolvedValue([finished({ flights: [] })]);

      await service.notificationFinishReservation();

      expect(notificationsService.create as jest.Mock).not.toHaveBeenCalled();
    });

    it('does not bring back bookings that ended long ago', async () => {
      (
        reservationsService.findFinishedReservations as jest.Mock
      ).mockResolvedValue([
        finished({ end_time: new Date(Date.now() - 30 * 24 * 3_600_000) }),
      ]);

      await service.notificationFinishReservation();

      expect(notificationsService.create as jest.Mock).not.toHaveBeenCalled();
    });

    it('should skip cancelled reservations and those whose flights are closed', async () => {
      (
        reservationsService.findFinishedReservations as jest.Mock
      ).mockResolvedValue([
        finished({ id: 8, status: 'CANCELLED' }),
        finished({ id: 9, flights: [{ closed_at: new Date() }] }),
      ]);

      await service.notificationFinishReservation();

      expect(notificationsService.create as jest.Mock).not.toHaveBeenCalled();
    });
  });
});
