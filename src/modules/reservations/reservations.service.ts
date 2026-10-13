import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  LessThan,
  MoreThan,
  Between,
  EntityManager,
  Not,
} from 'typeorm';
import { Reservation, ReservationStatus } from './entity/reservations.entity';
import { ReservationTemplate } from './entity/reservation-template.entity';
import { CreateReservationInput } from './dto/create-reservation.input';
import { UpdateReservationInput } from './dto/update-reservation.input';
import { CreateReservationTemplateInput } from './dto/create-reservation-template.input';
import { UpdateReservationTemplateInput } from './dto/update-reservation-template.input';
import { MailerService } from '../mail/mailer.service';
import { User } from '../users/entity/users.entity';
import {
  Aircraft,
  AvailabilityStatus,
} from '../aircraft/entity/aircraft.entity';
import { Maintenance } from '../maintenance/entity/maintenance.entity';
import {
  maintenanceWindow,
  occupiesAircraft,
} from '../maintenance/maintenance-rules';
import { InstructionCourse } from '../instruction-courses/entity/instruction-courses.entity';
import { CourseStatus } from '../instruction-courses/enum/course-status.enum';
import { AdministrationService } from '../administration/administration.service';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { languageOf } from '../../common/i18n/languages';
import { translate } from '../../common/i18n/translate';
import { localized } from '../../common/i18n/localized-exception';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { fromCents, lockRow, toCents } from '../payments/money';
import {
  assertAllowedToFly,
  assertCancellable,
  assertChangeable,
  assertClubOpen,
  assertValidSlot,
  BookingActor,
  clubMoment,
  hasValidLicence,
  mailDate,
  priceCents,
} from './booking-rules';

const DAY = 24 * 60 * 60 * 1000;

// Postgres codes of the two database guards on reservations.
const EXCLUSION_VIOLATION = '23P01';
const CHECK_VIOLATION = '23514';
const databaseErrorCode = (error: any): string | undefined =>
  error?.driverError?.code ?? error?.code;

const MEMBER: BookingActor = { isAdmin: false };

interface Slot {
  aircraftId: number;
  userId: number;
  start: Date;
  end: Date;
  flightCategory: string;
  // The booking being changed, which does not conflict with itself.
  excludeReservationId?: number;
}

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,
    @InjectRepository(ReservationTemplate)
    private templateRepository: Repository<ReservationTemplate>,
    private readonly mailerService: MailerService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Aircraft)
    private readonly aircraftRepository: Repository<Aircraft>,
    private readonly administrationService: AdministrationService,
    private readonly paymentService: PaymentsService,
    private readonly notificationService: NotificationsService,
  ) {}

  // A booking and the money that goes with it change in one transaction.
  private async inTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.reservationRepository.manager.transaction(work);
    } catch (error) {
      // The database refused what the checks let through: two requests for
      // the same slot at the same moment.
      if (databaseErrorCode(error) === EXCLUSION_VIOLATION) {
        throw localized(
          ConflictException,
          'error.reservation.aircraftAlreadyBooked',
        );
      }
      if (databaseErrorCode(error) === CHECK_VIOLATION) {
        throw localized(
          BadRequestException,
          'error.reservation.endBeforeStart',
        );
      }
      throw error;
    }
  }

  // Every rule a booking must satisfy, for a new booking and for a changed
  // one alike. The rows of the aircraft and of the pilot are locked first, so
  // two bookings of the same aircraft, or by the same pilot, are checked one
  // after the other.
  private async assertBookable(
    manager: EntityManager,
    slot: Slot,
    now: Date,
  ): Promise<{ aircraft: Aircraft; user: User }> {
    assertValidSlot(slot.start, slot.end, now);

    const aircraft = (await lockRow(manager, 'aircraft', slot.aircraftId))
      ? await manager.findOne(Aircraft, { where: { id: slot.aircraftId } })
      : null;
    if (!aircraft) {
      throw localized(NotFoundException, 'error.reservation.aircraftNotFound', {
        aircraftId: slot.aircraftId,
      });
    }

    const user = (await lockRow(manager, 'users', slot.userId))
      ? await manager.findOne(User, {
          where: { id: slot.userId },
          relations: ['licenses'],
        })
      : null;
    if (!user) {
      throw localized(NotFoundException, 'error.reservation.userNotFound', {
        userId: slot.userId,
      });
    }
    // A deactivated account is not booked for, by anyone.
    if (user.is_active === false) {
      throw localized(ForbiddenException, 'error.reservation.memberInactive');
    }

    if (aircraft.availability_status === AvailabilityStatus.UNAVAILABLE) {
      throw localized(
        ConflictException,
        'error.reservation.aircraftUnavailable',
      );
    }

    const overlapping = {
      start_time: LessThan(slot.end),
      end_time: MoreThan(slot.start),
      status: Not(ReservationStatus.CANCELLED),
    };
    const isAnotherBooking = (reservation: Reservation) =>
      reservation.id !== slot.excludeReservationId;

    const onAircraft = await manager.find(Reservation, {
      where: { aircraft: { id: aircraft.id }, ...overlapping },
    });
    if (onAircraft.some(isAnotherBooking)) {
      throw localized(
        ConflictException,
        'error.reservation.aircraftAlreadyBooked',
      );
    }

    // The period a maintenance holds the aircraft (its last day included)
    // is defined once, with the maintenance rules.
    const maintenances = await manager.find(Maintenance, {
      where: {
        aircraft: { id: aircraft.id },
        start_date: LessThan(slot.end),
      },
    });
    const heldByMaintenance = maintenances.some((maintenance) => {
      const window = maintenanceWindow(maintenance);
      return (
        occupiesAircraft(maintenance) &&
        window !== null &&
        window.start.getTime() < slot.end.getTime() &&
        slot.start.getTime() < window.end.getTime()
      );
    });
    if (heldByMaintenance) {
      throw localized(
        ConflictException,
        'error.reservation.aircraftInMaintenance',
      );
    }

    const byPilot = await manager.find(Reservation, {
      where: { user: { id: user.id }, ...overlapping },
    });
    if (byPilot.some(isAnotherBooking)) {
      throw localized(
        ConflictException,
        'error.reservation.pilotAlreadyBooked',
      );
    }

    const settings = (await this.administrationService.findAll())?.[0];
    if (!settings) {
      throw localized(NotFoundException, 'error.reservation.noClubSettings');
    }
    assertClubOpen(settings, slot.start, slot.end);

    const licensed = hasValidLicence(
      user.licenses,
      settings.pilotLicenses,
      slot.end,
    );
    assertAllowedToFly({
      licences: user.licenses,
      acceptedTypes: settings.pilotLicenses,
      flightCategory: slot.flightCategory,
      flightEnd: slot.end,
      hasLessonThatDay:
        !licensed &&
        (await this.hasLessonThatDay(manager, user.id, slot.start)),
    });

    return { aircraft, user };
  }

  // An instructor has scheduled a lesson with this student on the club day
  // of the flight.
  private async hasLessonThatDay(
    manager: EntityManager,
    studentId: number,
    start: Date,
  ): Promise<boolean> {
    const courses = await manager.find(InstructionCourse, {
      where: {
        student: { id: studentId },
        status: Not(CourseStatus.CANCELED),
        startTime: Between(
          new Date(start.getTime() - DAY),
          new Date(start.getTime() + DAY),
        ),
      },
      loadEagerRelations: false,
    });
    const day = clubMoment(start).day;
    return courses.some(
      (course) => clubMoment(new Date(course.startTime)).day === day,
    );
  }

  // E-mails and notifications leave once the transaction is committed: they
  // never announce something that did not happen, nor undo what did.
  private async announce(
    what: string,
    send: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await send();
    } catch (error) {
      this.logger.warn(`${what} not sent: ${error.message}`);
    }
  }

  async create(
    createReservationInput: CreateReservationInput,
    now: Date = new Date(),
  ): Promise<Reservation> {
    const { aircraft_id, user_id } = createReservationInput;
    const start = new Date(createReservationInput.start_time);
    const end = new Date(createReservationInput.end_time);

    const { reservation, aircraft, user, cents } = await this.inTransaction(
      async (manager) => {
        const { aircraft, user } = await this.assertBookable(
          manager,
          {
            aircraftId: aircraft_id,
            userId: user_id,
            start,
            end,
            flightCategory: createReservationInput.flight_category,
          },
          now,
        );
        const cents = priceCents(aircraft.hourly_cost, start, end);

        const reservation = await manager.save(
          Reservation,
          manager.create(Reservation, {
            aircraft,
            user,
            reservation_date: createReservationInput.reservation_date,
            start_time: start,
            end_time: end,
            purpose: createReservationInput.purpose,
            flight_category: createReservationInput.flight_category,
            estimated_flight_hours:
              createReservationInput.estimated_flight_hours,
            notes: createReservationInput.notes,
            status: ReservationStatus.CONFIRMED,
            // The price is fixed here: later refunds give back exactly this.
            charged_amount: fromCents(cents),
          }),
        );

        // Flight hours are counted when the flight is closed, not when it
        // is booked.
        if (cents > 0) {
          await this.paymentService.chargeBooking(manager, {
            userId: user.id,
            cents,
            reservationId: reservation.id,
          });
        }
        return { reservation, aircraft, user, cents };
      },
    );

    // The confirmation is written to the member the reservation is for.
    const language = languageOf(user);
    await this.announce('Booking confirmation e-mail', () =>
      this.mailerService.sendMail(
        user.email,
        translate(language, 'mail.reservationConfirmed.subject'),
        translate(language, 'mail.reservationConfirmed.text', {
          registration: aircraft.registration_number,
        }),
        'reservation-confirmation',
        {
          name: user.first_name,
          aircraft_registration: aircraft.registration_number,
          start_time: mailDate(start, language),
          end_time: mailDate(end, language),
        },
        language,
      ),
    );
    await this.announce('Booking confirmation notification', () =>
      this.notificationService.create({
        user_id: user.id,
        notification_type: 'RESERVATION_CONFIRMED',
        notification_date: new Date(),
        message: translate(language, 'notification.reservationConfirmed', {
          registration: aircraft.registration_number,
        }),
        is_read: false,
      }),
    );
    if (cents > 0) {
      await this.paymentService.notifyMovement(
        user,
        'WITHDRAWAL',
        fromCents(cents),
      );
    }

    return reservation;
  }

  // A booking is changed by its holder or an administrator (checked by the
  // resolver), before it starts, through the same rules as a new one. A new
  // slot or aircraft is priced again and the difference charged or refunded.
  async update(
    updateReservationInput: UpdateReservationInput,
    now: Date = new Date(),
  ): Promise<Reservation> {
    const id = updateReservationInput.id;

    const changed = await this.inTransaction(async (manager) => {
      const reservation = (await lockRow(manager, 'reservations', id))
        ? await manager.findOne(Reservation, { where: { id } })
        : null;
      if (!reservation) {
        throw localized(NotFoundException, 'error.reservation.notFound');
      }
      assertChangeable(reservation, now);

      if (
        updateReservationInput.user_id != null &&
        Number(updateReservationInput.user_id) !== Number(reservation.user.id)
      ) {
        throw localized(
          BadRequestException,
          'error.reservation.holderCannotChange',
        );
      }

      const previous = {
        start: new Date(reservation.start_time),
        end: new Date(reservation.end_time),
      };
      const start = updateReservationInput.start_time
        ? new Date(updateReservationInput.start_time)
        : previous.start;
      const end = updateReservationInput.end_time
        ? new Date(updateReservationInput.end_time)
        : previous.end;
      const aircraftId = Number(
        updateReservationInput.aircraft_id ?? reservation.aircraft.id,
      );
      const flightCategory =
        updateReservationInput.flight_category ?? reservation.flight_category;

      const slotChanged =
        start.getTime() !== previous.start.getTime() ||
        end.getTime() !== previous.end.getTime() ||
        aircraftId !== Number(reservation.aircraft.id);

      let aircraft = reservation.aircraft;
      let movedCents = 0;
      if (slotChanged || flightCategory !== reservation.flight_category) {
        ({ aircraft } = await this.assertBookable(
          manager,
          {
            aircraftId,
            userId: reservation.user.id,
            start,
            end,
            flightCategory,
            excludeReservationId: reservation.id,
          },
          now,
        ));
      }

      if (slotChanged) {
        if (reservation.charged_amount == null) {
          throw localized(
            BadRequestException,
            'error.reservation.priceUnknown',
          );
        }
        const newCents = priceCents(aircraft.hourly_cost, start, end);
        movedCents = newCents - toCents(reservation.charged_amount);
        if (movedCents > 0) {
          await this.paymentService.chargeBooking(manager, {
            userId: reservation.user.id,
            cents: movedCents,
            reservationId: reservation.id,
          });
        } else if (movedCents < 0) {
          await this.paymentService.refundBooking(manager, {
            userId: reservation.user.id,
            cents: -movedCents,
            reservationId: reservation.id,
          });
        }
        reservation.charged_amount = fromCents(newCents);
        reservation.aircraft = aircraft;
        reservation.start_time = start;
        reservation.end_time = end;
      }

      reservation.flight_category =
        flightCategory as Reservation['flight_category'];
      for (const field of [
        'purpose',
        'notes',
        'estimated_flight_hours',
        'reservation_date',
      ] as const) {
        if (updateReservationInput[field] !== undefined) {
          (reservation as any)[field] = updateReservationInput[field];
        }
      }

      const saved = await manager.save(Reservation, reservation);
      return { saved, previous, movedCents };
    });

    const { saved, previous, movedCents } = changed;
    const user = saved.user;
    // The aircraft named is the one of the booking as it now stands.
    const registration = saved.aircraft.registration_number;
    const language = languageOf(user);

    await this.announce('Booking change e-mail', () =>
      this.mailerService.sendMail(
        user.email,
        translate(language, 'mail.reservationModified.subject'),
        translate(language, 'mail.reservationModified.text', { registration }),
        'reservation-modification',
        {
          name: user.first_name,
          aircraft_registration: registration,
          previous_start_time: mailDate(previous.start, language),
          previous_end_time: mailDate(previous.end, language),
          new_start_time: mailDate(saved.start_time, language),
          new_end_time: mailDate(saved.end_time, language),
        },
        language,
      ),
    );
    await this.announce('Booking change notification', () =>
      this.notificationService.create({
        user_id: user.id,
        notification_type: 'RESERVATION_MODIFIED',
        notification_date: new Date(),
        message: translate(language, 'notification.reservationModified', {
          registration,
        }),
        is_read: false,
      }),
    );
    if (movedCents !== 0) {
      await this.paymentService.notifyMovement(
        user,
        movedCents > 0 ? 'WITHDRAWAL' : 'PAYMENT_REFUNDED',
        fromCents(Math.abs(movedCents)),
      );
    }

    return saved;
  }

  // Cancels a booking and gives back what was charged for it, once: both
  // happen in one transaction, on a row locked for its duration.
  async delete(
    id: number,
    actor: BookingActor = MEMBER,
    now: Date = new Date(),
  ): Promise<void> {
    const { reservation, cents } = await this.inTransaction(async (manager) => {
      const reservation = (await lockRow(manager, 'reservations', id))
        ? await manager.findOne(Reservation, {
            where: { id },
            relations: ['flights'],
          })
        : null;
      if (!reservation) {
        throw localized(NotFoundException, 'error.reservation.notFound');
      }
      assertCancellable(reservation, actor, now);

      // Exactly what was charged; nothing when nothing was.
      const cents = toCents(reservation.charged_amount ?? 0);
      if (cents > 0) {
        await this.paymentService.refundBooking(manager, {
          userId: reservation.user.id,
          cents,
          reservationId: reservation.id,
        });
      }

      // A checklist filled for this booking is kept, without its booking:
      // its foreign key would otherwise refuse the deletion.
      await manager.query(
        `UPDATE "checklist_submissions" SET "reservationId" = NULL WHERE "reservationId" = $1`,
        [id],
      );
      const removed = await manager.delete(Reservation, { id });
      if (!removed.affected) {
        throw localized(NotFoundException, 'error.reservation.notFound');
      }
      return { reservation, cents };
    });

    const user = reservation.user;
    const registration = reservation.aircraft.registration_number;
    const language = languageOf(user);

    await this.announce('Booking cancellation e-mail', () =>
      this.mailerService.sendMail(
        user.email,
        translate(language, 'mail.reservationCancelled.subject'),
        translate(language, 'mail.reservationCancelled.text', { registration }),
        'reservation-cancellation',
        {
          name: user.first_name,
          aircraft_registration: registration,
          start_time: mailDate(reservation.start_time, language),
          end_time: mailDate(reservation.end_time, language),
        },
        language,
      ),
    );
    if (cents > 0) {
      await this.paymentService.notifyMovement(
        user,
        'PAYMENT_REFUNDED',
        fromCents(cents),
      );
    }
    await this.announce('Booking cancellation notification', () =>
      this.notificationService.create({
        user_id: user.id,
        notification_type: 'RESERVATION_CANCELLED',
        notification_date: new Date(),
        message: translate(language, 'notification.reservationCancelled', {
          registration,
        }),
        is_read: false,
      }),
    );
  }

  async findAll(): Promise<Reservation[]> {
    return this.reservationRepository.find();
  }

  // Id of the user who holds a reservation, or null if it does not exist.
  async findOwnerId(id: number): Promise<number | null> {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    return reservation?.user?.id ?? null;
  }

  async findOne(id: number): Promise<Reservation> {
    return this.reservationRepository.findOne({
      where: { id },
    });
  }

  async findFilteredReservations(
    startDate?: string,
    endDate?: string,
  ): Promise<Reservation[]> {
    const queryBuilder =
      this.reservationRepository.createQueryBuilder('reservation');

    // Every booking that touches the period, including one that crosses
    // its bounds: the schedule must not show as free a slot the API refuses.
    if (startDate) {
      queryBuilder.andWhere('reservation.end_time > :startDate', {
        startDate,
      });
    }

    if (endDate) {
      queryBuilder.andWhere('reservation.start_time < :endDate', { endDate });
    }

    queryBuilder.leftJoinAndSelect('reservation.aircraft', 'aircraft');
    queryBuilder.leftJoinAndSelect('reservation.user', 'user');
    // Flights come along so the calendar knows which bookings are closed.
    queryBuilder.leftJoinAndSelect('reservation.flights', 'flights');

    return await queryBuilder.getMany();
  }

  async findUserReservations(userId: number): Promise<Reservation[]> {
    return this.reservationRepository.find({
      where: { user: { id: userId } },
      relations: ['aircraft', 'user', 'flights'],
    });
  }

  async findReservationsBetween(
    start: Date,
    end: Date,
  ): Promise<Reservation[]> {
    return this.reservationRepository.find({
      where: {
        start_time: Between(start, end),
      },
      relations: ['user', 'flights'],
    });
  }

  async findFinishedReservations(): Promise<Reservation[]> {
    return this.reservationRepository.find({
      where: {
        end_time: LessThan(new Date()),
      },
      relations: ['user', 'flights'],
    });
  }

  async findRecentReservations(limit: number): Promise<Reservation[]> {
    return this.reservationRepository.find({
      order: { start_time: 'DESC' },
      take: limit,
      relations: ['user', 'aircraft'],
    });
  }

  // === Reservation Templates ===

  async getUserTemplates(userId: number): Promise<ReservationTemplate[]> {
    return this.templateRepository.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
    });
  }

  async findOneTemplate(id: number): Promise<ReservationTemplate> {
    const template = await this.templateRepository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template avec l'ID ${id} introuvable`);
    }
    return template;
  }

  async createTemplate(
    userId: number,
    input: CreateReservationTemplateInput,
  ): Promise<ReservationTemplate> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Utilisateur introuvable`);
    }

    let aircraft: Aircraft | null = null;
    if (input.aircraft_id) {
      aircraft = await this.aircraftRepository.findOne({
        where: { id: input.aircraft_id },
      });
    }

    const template = this.templateRepository.create({
      ...input,
      user,
      aircraft,
    });

    return this.templateRepository.save(template);
  }

  async updateTemplate(
    userId: number,
    input: UpdateReservationTemplateInput,
  ): Promise<ReservationTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id: input.id, user: { id: userId } },
    });
    if (!template) {
      throw new NotFoundException(`Template introuvable ou non autorisé`);
    }

    if (input.aircraft_id !== undefined) {
      template.aircraft = input.aircraft_id
        ? await this.aircraftRepository.findOne({
            where: { id: input.aircraft_id },
          })
        : null;
    }

    // The identifier and the aircraft are handled apart from the other fields.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, aircraft_id, ...rest } = input;
    Object.assign(template, rest);

    return this.templateRepository.save(template);
  }

  async deleteTemplate(userId: number, id: number): Promise<boolean> {
    const template = await this.templateRepository.findOne({
      where: { id, user: { id: userId } },
    });
    if (!template) {
      throw new NotFoundException(`Template introuvable ou non autorisé`);
    }
    await this.templateRepository.remove(template);
    return true;
  }
}
