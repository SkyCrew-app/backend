import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InstructionCoursesService } from '../instruction-courses/instruction-courses.service';
import { LicensesService } from '../licenses/licenses.service';
import { LicenceRemindersService } from '../licenses/licence-reminders.service';
import { InstructionCourse } from '../instruction-courses/entity/instruction-courses.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ReservationsService } from '../reservations/reservations.service';
import { FinancialService } from '../financial/financial.service';
import {
  Reservation,
  ReservationStatus,
} from '../reservations/entity/reservations.entity';
import { languageOf } from '../../common/i18n/languages';
import {
  CLUB_TIME_ZONE,
  clubDayStart,
  clubMoment,
  clubMonthStart,
} from '../reservations/booking-rules';
import {
  translate,
  translateInEveryLanguage,
} from '../../common/i18n/translate';

// The jobs run on the club's clock (midnight in Paris), not the server's.
const CLUB_SCHEDULE = { timeZone: CLUB_TIME_ZONE };

// A deactivated member is no longer written to: no reminder, no e-mail.
// Their bookings and licences are left as they are.
const isDeactivated = (user?: { is_active?: boolean | null } | null): boolean =>
  user?.is_active === false;

// Reminders to close a flight stop once the booking ended that long ago.
export const FINISHED_REMINDER_MAX_AGE_DAYS = 7;

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly courseService: InstructionCoursesService,
    private readonly licensesService: LicensesService,
    private readonly notificationsService: NotificationsService,
    private readonly reservationsService: ReservationsService,
    private readonly financialService: FinancialService,
    private readonly licenceReminders: LicenceRemindersService,
  ) {}

  // Vérification quotidienne des statuts des cours
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, CLUB_SCHEDULE)
  async handleCourseStatusUpdate() {
    this.logger.log('Vérification quotidienne des statuts des cours...');
    let expiredCourses: InstructionCourse[];
    try {
      expiredCourses = await this.courseService.findExpiredCourses();
    } catch (error) {
      this.logger.error(
        'Erreur lors de la mise à jour des statuts des cours',
        error,
      );
      return;
    }

    for (const course of expiredCourses) {
      // One course that fails must not stop the others.
      try {
        await this.courseService.updateCourseStatus(
          course.id,
          'COMPLETED' as InstructionCourse['status'],
        );
        this.logger.log(
          `Statut du cours ${course.id} mis à jour en "COMPLETED"`,
        );
        // Both the student and the instructor are told, each in their
        // own language.
        for (const participant of [course.student, course.instructor]) {
          if (!participant?.id || isDeactivated(participant)) continue;
          await this.notificationsService.create({
            user_id: participant.id,
            notification_type: 'COURSE_COMPLETED',
            message: translate(
              languageOf(participant),
              'notification.courseCompleted',
              { courseId: course.id },
            ),
            notification_date: new Date(),
            is_read: false,
          });
        }
      } catch (error) {
        this.logger.error(
          `Erreur lors de la mise à jour du statut du cours ${course.id}`,
          error,
        );
      }
    }
  }

  // Vérification quotidienne des licences : celles dont la date est passée
  // sont marquées expirées, puis les rappels avant expiration sont envoyés.
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, CLUB_SCHEDULE)
  async handleLicenseExpiration(now: Date = new Date()) {
    try {
      // Only the licences whose date has passed: 0 days ahead.
      const overdue = await this.licensesService.findExpiringLicenses(0, now);
      for (const license of overdue) {
        if (
          !license.expiration_date ||
          new Date(license.expiration_date) >= now ||
          license.status === 'expired'
        ) {
          continue;
        }
        await this.licensesService.update({
          id: license.id,
          status: 'expired',
          is_valid: false,
        } as any);
        this.logger.log(`Licence ${license.id} marquée comme expirée.`);
        // The licence is marked for everyone; only active members are told.
        if (!license.user?.id || isDeactivated(license.user)) continue;
        await this.notificationsService.create({
          user_id: license.user.id,
          notification_type: 'LICENSE_EXPIRED',
          message: translate(
            languageOf(license.user),
            'notification.licenceExpired',
            { licenceType: license.license_type },
          ),
          notification_date: new Date(),
          expiration_date: license.expiration_date,
          is_read: false,
        });
      }
    } catch (error) {
      this.logger.error(
        'Erreur lors de la vérification des licences expirées',
        error,
      );
    }

    // 60, 30 and 7 days before expiry, once each, by e-mail and in the
    // application (see licence-rules).
    try {
      const sent = await this.licenceReminders.sendExpiryReminders(now);
      if (sent > 0) {
        this.logger.log(`${sent} rappel(s) d'expiration de licence envoyé(s).`);
      }
    } catch (error) {
      this.logger.error(
        'Erreur lors des rappels d’expiration de licence',
        error,
      );
    }
  }

  // Le 1er du mois à 8 h : la liste des licences qui expirent bientôt,
  // envoyée aux administrateurs.
  @Cron('0 8 1 * *', CLUB_SCHEDULE)
  async sendLicenceDigest(now: Date = new Date()) {
    try {
      const sent = await this.licenceReminders.sendAdminDigest(now);
      this.logger.log(
        `Récapitulatif des licences envoyé à ${sent} administrateur(s).`,
      );
    } catch (error) {
      this.logger.error(
        'Erreur lors de l’envoi du récapitulatif des licences',
        error,
      );
    }
  }

  // Vérification quotidienne des réservations pour demain
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, CLUB_SCHEDULE)
  async handleReservationNotifications() {
    this.logger.log('Début de la vérification des réservations pour demain...');

    // Tomorrow at the club, whatever the server's time zone.
    const now = new Date();
    const startOfTomorrow = clubDayStart(now, 1);
    const endOfTomorrow = new Date(clubDayStart(now, 2).getTime() - 1);

    const reservations: Reservation[] =
      await this.reservationsService.findReservationsBetween(
        startOfTomorrow,
        endOfTomorrow,
      );

    for (const reservation of reservations) {
      if (isDeactivated(reservation.user)) continue;
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
        const flights = reservation.flights ?? [];
        const reminder =
          flights.length === 0
            ? ({
                type: 'MISSING_FLIGHT_PLAN',
                key: 'notification.missingFlightPlan',
              } as const)
            : flights.some(
                  (flight) => !flight.encoded_polyline || !flight.waypoints,
                )
              ? ({
                  type: 'INCOMPLETE_FLIGHT_PLAN',
                  key: 'notification.incompleteFlightPlan',
                } as const)
              : null;

        // Sent once per booking, even when the job runs twice (two
        // instances, a restart at midnight).
        if (
          reminder &&
          !(await this.notificationsService.alreadySent(
            reservation.user.id,
            reminder.type,
            translateInEveryLanguage(reminder.key, { reservationId }),
          ))
        ) {
          await this.notificationsService.create({
            user_id: reservation.user.id,
            notification_type: reminder.type,
            message: translate(language, reminder.key, { reservationId }),
            notification_date: new Date(),
            is_read: false,
          });
          this.logger.log(
            `Notification ${reminder.type} envoyée pour la réservation N°${reservation.id}`,
          );
        }
        // The number of passengers is not asked for when booking: there is
        // nothing to remind the member of.
      }
    }

    this.logger.log('Fin de la vérification des réservations pour demain.');
  }

  // Agrégation financière mensuelle : le mois qui vient de se terminer.
  // Running it again for the same month refreshes its report instead of
  // adding a second one.
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT, CLUB_SCHEDULE)
  async generateMonthlyFinancialReport(now: Date = new Date()) {
    this.logger.log('Démarrage de l’agrégation financière mensuelle.');

    // The month that just ended at the club.
    const startOfMonth = clubMonthStart(now, -1);
    const startOfNextMonth = clubMonthStart(now, 0);
    // The aggregations take both bounds in: the last instant of the month.
    const endOfMonth = new Date(startOfNextMonth.getTime() - 1);

    const totalRevenue = await this.financialService.aggregateRevenuesForPeriod(
      startOfMonth,
      endOfMonth,
    );
    const totalExpense = await this.financialService.aggregateExpensesForPeriod(
      startOfMonth,
      endOfMonth,
    );
    const netProfit = totalRevenue - totalExpense;

    const reports = await this.financialService.findAllFinancialReports();
    const existing = (reports ?? []).find((report) => {
      const date = new Date(report.report_date);
      return (
        clubMoment(date).day.slice(0, 7) ===
        clubMoment(startOfMonth).day.slice(0, 7)
      );
    });

    if (existing) {
      await this.financialService.updateFinancialReport({
        id: existing.id,
        total_revenue: totalRevenue,
        total_expense: totalExpense,
        net_profit: netProfit,
      });
    } else {
      await this.financialService.createFinancialReport({
        report_date: startOfMonth,
        total_revenue: totalRevenue,
        total_expense: totalExpense,
        net_profit: netProfit,
        recommendations: null,
        average_revenue_per_member: null,
      });
    }

    this.logger.log('Rapport financier mensuel généré avec succès.');
  }

  // Notification de fin de réservation
  @Cron(CronExpression.EVERY_HOUR, CLUB_SCHEDULE)
  async notificationFinishReservation() {
    const oldest =
      Date.now() - FINISHED_REMINDER_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const reservations =
      await this.reservationsService.findFinishedReservations(new Date(oldest));

    for (const reservation of reservations) {
      if (!reservation.user || isDeactivated(reservation.user)) continue;
      if (String(reservation.status).toUpperCase() === 'CANCELLED') continue;
      // Only a flight that is still open can be closed: nothing to ask for a
      // booking without a flight plan, or once every flight is closed.
      const flights = reservation.flights ?? [];
      if (!flights.some((flight) => !flight.closed_at)) {
        continue;
      }
      // Old bookings are not brought back when a member empties their
      // notifications.
      if (new Date(reservation.end_time).getTime() < oldest) {
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
