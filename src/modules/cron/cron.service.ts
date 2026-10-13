import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InstructionCoursesService } from '../instruction-courses/instruction-courses.service';
import { LicensesService } from '../licenses/licenses.service';
import { InstructionCourse } from '../instruction-courses/entity/instruction-courses.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ReservationsService } from '../reservations/reservations.service';
import { FinancialService } from '../financial/financial.service';
import {
  Reservation,
  ReservationStatus,
} from '../reservations/entity/reservations.entity';
import { formatDate, languageOf } from '../../common/i18n/languages';
import {
  translate,
  translateInEveryLanguage,
} from '../../common/i18n/translate';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly courseService: InstructionCoursesService,
    private readonly licensesService: LicensesService,
    private readonly notificationsService: NotificationsService,
    private readonly reservationsService: ReservationsService,
    private readonly financialService: FinancialService,
  ) {}

  // Vérification quotidienne des statuts des cours
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCourseStatusUpdate() {
    this.logger.log('Vérification quotidienne des statuts des cours...');
    try {
      const expiredCourses = await this.courseService.findExpiredCourses();
      for (const course of expiredCourses) {
        await this.courseService.updateCourseStatus(
          course.id,
          'COMPLETED' as InstructionCourse['status'],
        );
        this.logger.log(
          `Statut du cours ${course.id} mis à jour en "COMPLETED"`,
        );
        await this.notificationsService.create({
          user_id: course.student.id && course.instructor.id,
          notification_type: 'COURSE_COMPLETED',
          // Written to the instructor, who is the one notified here.
          message: translate(
            languageOf(course.instructor),
            'notification.courseCompleted',
            { courseId: course.id },
          ),
          notification_date: new Date(),
          is_read: false,
        });
      }
    } catch (error) {
      this.logger.error(
        'Erreur lors de la mise à jour des statuts des cours',
        error,
      );
    }
  }

  // Vérification quotidienne des licences (expiration ou bientôt expirées)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleLicenseExpiration() {
    try {
      const thresholdDays = 7;
      const expiringLicenses =
        await this.licensesService.findExpiringLicenses(thresholdDays);
      for (const license of expiringLicenses) {
        const userId = license.user.id;
        const language = languageOf(license.user);
        if (
          license.expiration_date &&
          new Date(license.expiration_date) < new Date()
        ) {
          if (license.status !== 'expired') {
            await this.licensesService.update({
              id: license.id,
              status: 'expired',
            } as any);
            this.logger.log(`Licence ${license.id} marquée comme expirée.`);
            await this.notificationsService.create({
              user_id: userId,
              notification_type: 'LICENSE_EXPIRED',
              message: translate(language, 'notification.licenceExpired', {
                licenceType: license.license_type,
              }),
              notification_date: new Date(),
              expiration_date: license.expiration_date,
              is_read: false,
            });
          }
        } else {
          await this.notificationsService.create({
            user_id: userId,
            notification_type: 'LICENSE_EXPIRING_SOON',
            message: translate(language, 'notification.licenceExpiringSoon', {
              licenceType: license.license_type,
              date: formatDate(language, license.expiration_date),
            }),
            notification_date: new Date(),
            expiration_date: license.expiration_date,
            is_read: false,
          });
        }
      }
    } catch (error) {
      this.logger.error(
        'Erreur lors de la vérification des licences expirées',
        error,
      );
    }
  }

  // Vérification quotidienne des réservations pour demain
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleReservationNotifications() {
    this.logger.log('Début de la vérification des réservations pour demain...');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfTomorrow = new Date(tomorrow);
    startOfTomorrow.setHours(0, 0, 0, 0);
    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setHours(23, 59, 59, 999);

    const reservations: Reservation[] =
      await this.reservationsService.findReservationsBetween(
        startOfTomorrow,
        endOfTomorrow,
      );

    for (const reservation of reservations) {
      const language = languageOf(reservation.user);
      const reservationId = reservation.id;

      // Vérification 1 : Si la réservation est en attente de confirmation
      if (reservation.status === ReservationStatus.PENDING) {
        await this.notificationsService.create({
          user_id: reservation.user.id,
          notification_type: 'RESERVATION_PENDING',
          message: translate(language, 'notification.reservationPending', {
            reservationId,
          }),
          notification_date: new Date(),
          is_read: false,
        });
        this.logger.log(
          `Notification envoyée pour réservation en attente N°${reservation.id}`,
        );
      }

      // Vérification 2 : Si la réservation est confirmée, on vérifie le plan de vol
      if (reservation.status === ReservationStatus.CONFIRMED) {
        if (!reservation.flights || reservation.flights.length === 0) {
          await this.notificationsService.create({
            user_id: reservation.user.id,
            notification_type: 'MISSING_FLIGHT_PLAN',
            message: translate(language, 'notification.missingFlightPlan', {
              reservationId,
            }),
            notification_date: new Date(),
            is_read: false,
          });
          this.logger.log(
            `Notification envoyée pour plan de vol manquant (aucun vol associé) pour la réservation N°${reservation.id}`,
          );
        } else {
          let missingPlan = false;
          for (const flight of reservation.flights) {
            if (!flight.encoded_polyline || !flight.waypoints) {
              missingPlan = true;
              break;
            }
          }
          if (missingPlan) {
            await this.notificationsService.create({
              user_id: reservation.user.id,
              notification_type: 'INCOMPLETE_FLIGHT_PLAN',
              message: translate(
                language,
                'notification.incompleteFlightPlan',
                { reservationId },
              ),
              notification_date: new Date(),
              is_read: false,
            });
            this.logger.log(
              `Notification envoyée pour plan de vol incomplet pour la réservation N°${reservation.id}`,
            );
          }
        }

        // Vérification 3 : Vérifier si le nombre de passagers est renseigné
        if (reservation.number_of_passengers == null) {
          await this.notificationsService.create({
            user_id: reservation.user.id,
            notification_type: 'MISSING_PASSENGER_COUNT',
            message: translate(language, 'notification.missingPassengerCount', {
              reservationId,
            }),
            notification_date: new Date(),
            is_read: false,
          });
          this.logger.log(
            `Notification envoyée pour nombre de passagers manquant pour la réservation N°${reservation.id}`,
          );
        }
      }
    }

    this.logger.log('Fin de la vérification des réservations pour demain.');
  }

  // Agrégation financière mensuelle
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async generateMonthlyFinancialReport() {
    this.logger.log('Démarrage de l’agrégation financière mensuelle.');

    const currentDate = new Date();
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );

    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
    );

    const totalRevenue = await this.financialService.aggregateRevenuesForPeriod(
      startOfMonth,
      endOfMonth,
    );
    const totalExpense = await this.financialService.aggregateExpensesForPeriod(
      startOfMonth,
      endOfMonth,
    );
    const netProfit = totalRevenue - totalExpense;

    const reportDate = startOfMonth;

    await this.financialService.createFinancialReport({
      report_date: reportDate,
      total_revenue: totalRevenue,
      total_expense: totalExpense,
      net_profit: netProfit,
      recommendations: null,
      average_revenue_per_member: null,
    });

    this.logger.log('Rapport financier mensuel généré avec succès.');
  }

  // Notification de fin de réservation
  @Cron(CronExpression.EVERY_HOUR)
  async notificationFinishReservation() {
    const reservations =
      await this.reservationsService.findFinishedReservations();

    for (const reservation of reservations) {
      if (!reservation.user) continue;
      if (String(reservation.status).toUpperCase() === 'CANCELLED') continue;
      // Nothing left to close once every flight of the reservation is closed.
      const flights = reservation.flights ?? [];
      if (flights.length > 0 && flights.every((flight) => flight.closed_at)) {
        continue;
      }

      const params = { reservationId: reservation.id };
      const message = translate(
        languageOf(reservation.user),
        'notification.reservationFinished',
        params,
      );
      // This job runs every hour: remind once, not at every run. The reminder
      // may have been written in another language if the member changed
      // theirs since.
      const alreadySent = await this.notificationsService.alreadySent(
        reservation.user.id,
        'RESERVATION_FINISHED',
        translateInEveryLanguage('notification.reservationFinished', params),
      );
      if (alreadySent) continue;

      await this.notificationsService.create({
        user_id: reservation.user.id,
        notification_type: 'RESERVATION_FINISHED',
        message,
        notification_date: new Date(),
        is_read: false,
      });
    }
  }
}
