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
    };
    reservationsService = {
      findReservationsBetween: jest.fn(),
      findFinishedReservations: jest.fn(),
    };
    financialService = {
      aggregateRevenuesForPeriod: jest.fn(),
      aggregateExpensesForPeriod: jest.fn(),
      createFinancialReport: jest.fn(),
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
      expect(notificationsService.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_type: 'COURSE_COMPLETED',
          message: `Votre cours 1 est terminé.`,
        }),
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

      expect(licensesService.update as jest.Mock).toHaveBeenCalledWith({
        id: 2,
        status: 'expired',
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

    it('should notify missing flight plan and passenger count', async () => {
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

      expect(notificationsService.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_type: 'INCOMPLETE_FLIGHT_PLAN',
        }),
      );
      expect(notificationsService.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_type: 'MISSING_PASSENGER_COUNT',
        }),
      );
    });
  });

  describe('generateMonthlyFinancialReport', () => {
    it('should aggregate and create report', async () => {
      (
        financialService.aggregateRevenuesForPeriod as jest.Mock
      ).mockResolvedValue(1000);
      (
        financialService.aggregateExpensesForPeriod as jest.Mock
      ).mockResolvedValue(400);

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
  });

  describe('notificationFinishReservation', () => {
    it('should notify finished reservations', async () => {
      const reservations = [{ id: 7, user: { id: 70 } } as any];
      (
        reservationsService.findFinishedReservations as jest.Mock
      ).mockResolvedValue(reservations);

      await service.notificationFinishReservation();

      expect(notificationsService.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_type: 'RESERVATION_FINISHED',
          message: expect.stringContaining('réservation N°7'),
        }),
      );
    });
  });
});
