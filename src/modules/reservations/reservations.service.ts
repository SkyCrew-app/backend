import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  LessThan,
  MoreThan,
  Between,
  EntityManager,
  In,
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
import { courseEnd } from '../instruction-courses/course-rules';
import {
  isAdmin,
  ROLE_INSTRUCTOR,
  SessionUser,
} from '../../common/auth/access';
import { AdministrationService } from '../administration/administration.service';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Language, languageOf } from '../../common/i18n/languages';
import { translate } from '../../common/i18n/translate';
import { localized } from '../../common/i18n/localized-exception';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { fromCents, lockRow, toCents } from '../payments/money';
import {
  assertAllowedToFly,
  assertCancellable,
  assertCanInstruct,
  assertChangeable,
  assertClubOpen,
  assertValidSlot,
  BookingActor,
  hasValidLicence,
  INSTRUCTION_FLIGHT_CATEGORY,
  instructorFeeCents,
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

const sameMember = (a: unknown, b: unknown): boolean =>
  a != null && b != null && Number(a) === Number(b);

const fullName = (member: { first_name?: string; last_name?: string }) =>
  [member?.first_name, member?.last_name].filter(Boolean).join(' ');

// What an instructor is told about a booking they instruct.
type InstructorNotice = 'Booked' | 'Changed' | 'Cancelled';

interface Slot {
  aircraftId: number;
  userId: number;
  // The instructor on board, or null for a flight without one.
  instructorId: number | null;
  start: Date;
  end: Date;
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
  // one alike. The rows of the aircraft, of the pilot and of the instructor
  // are locked first, so two bookings sharing one of them are checked one
  // after the other.
  private async assertBookable(
    manager: EntityManager,
    slot: Slot,
    now: Date,
  ): Promise<{ aircraft: Aircraft; user: User; instructor: User | null }> {
    assertValidSlot(slot.start, slot.end, now);

    const aircraft = (await lockRow(manager, 'aircraft', slot.aircraftId))
      ? await manager.findOne(Aircraft, { where: { id: slot.aircraftId } })
      : null;
    if (!aircraft) {
      throw localized(NotFoundException, 'error.reservation.aircraftNotFound', {
        aircraftId: slot.aircraftId,
      });
    }

    // Members are locked in the order of their ids: two bookings that share
    // a pilot and an instructor the other way round cannot block each other.
    const found = new Map<number, boolean>();
    const memberIds = [slot.userId, slot.instructorId]
      .filter((id): id is number => id != null)
      .map(Number);
    for (const id of [...new Set(memberIds)].sort((a, b) => a - b)) {
      found.set(id, await lockRow(manager, 'users', id));
    }

    const user = found.get(Number(slot.userId))
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

    let instructor: User | null = null;
    if (slot.instructorId != null) {
      instructor = found.get(Number(slot.instructorId))
        ? await manager.findOne(User, {
            where: { id: slot.instructorId },
            relations: ['licenses', 'role'],
          })
        : null;
      if (!instructor) {
        throw localized(
          NotFoundException,
          'error.reservation.instructorNotFound',
        );
      }
      assertCanInstruct(instructor, user.id);
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

    // Nobody is on two aircraft at once, whichever seat they take: a member
    // is busy on the bookings they hold and on those they instruct.
    const isBusy = async (memberId: number): Promise<boolean> => {
      const asPilot = await manager.find(Reservation, {
        where: { user: { id: memberId }, ...overlapping },
      });
      const asInstructor = await manager.find(Reservation, {
        where: { instructor: { id: memberId }, ...overlapping },
      });
      return [...asPilot, ...asInstructor].some(isAnotherBooking);
    };

    if (await isBusy(user.id)) {
      throw localized(
        ConflictException,
        'error.reservation.pilotAlreadyBooked',
      );
    }
    if (instructor) {
      if (await isBusy(instructor.id)) {
        throw localized(
          ConflictException,
          'error.reservation.instructorAlreadyBooked',
        );
      }
      if (
        await this.teachesSomeoneElse(manager, instructor.id, user.id, slot)
      ) {
        throw localized(
          ConflictException,
          'error.reservation.instructorHasCourse',
        );
      }
    }

    const settings = (await this.administrationService.findAll())?.[0];
    if (!settings) {
      throw localized(NotFoundException, 'error.reservation.noClubSettings');
    }
    assertClubOpen(settings, slot.start, slot.end);

    assertAllowedToFly({
      pilotLicences: user.licenses,
      instructorLicences: instructor?.licenses,
      withInstructor: instructor !== null,
      acceptedTypes: settings.pilotLicenses,
      flightEnd: slot.end,
    });

    return { aircraft, user, instructor };
  }

  // The instructor has a course planned with another student over the slot.
  // A course with the pilot of the booking is the flight itself.
  private async teachesSomeoneElse(
    manager: EntityManager,
    instructorId: number,
    pilotId: number,
    slot: Slot,
  ): Promise<boolean> {
    const courses = await manager.find(InstructionCourse, {
      where: {
        instructor: { id: instructorId },
        status: In([CourseStatus.SCHEDULED, CourseStatus.IN_PROGRESS]),
        startTime: Between(new Date(slot.start.getTime() - DAY), slot.end),
      },
      relations: ['student'],
      loadEagerRelations: false,
    });
    return courses.some(
      (course) =>
        !sameMember(course.student?.id, pilotId) &&
        new Date(course.startTime).getTime() < slot.end.getTime() &&
        courseEnd(course).getTime() > slot.start.getTime(),
    );
  }

  // The course a booking is made for: a scheduled course of the caller,
  // without a booking yet, over the same time.
  private async courseToBook(
    manager: EntityManager,
    courseId: number,
    start: Date,
    end: Date,
    requester?: SessionUser | null,
  ): Promise<InstructionCourse> {
    const course = await manager.findOne(InstructionCourse, {
      where: { id: courseId },
      relations: ['instructor', 'student', 'reservation'],
      loadEagerRelations: false,
    });
    if (!course) {
      throw localized(NotFoundException, 'error.reservation.courseNotFound');
    }
    // Internal callers (demo data) give no requester.
    if (
      requester &&
      !isAdmin(requester) &&
      !sameMember(course.student?.id, requester.id) &&
      !sameMember(course.instructor?.id, requester.id)
    ) {
      throw localized(ForbiddenException, 'error.reservation.courseNotYours');
    }
    if (course.status !== CourseStatus.SCHEDULED) {
      throw localized(
        ConflictException,
        'error.reservation.courseNotScheduled',
      );
    }
    if (course.reservation) {
      throw localized(
        ConflictException,
        'error.reservation.courseAlreadyBooked',
      );
    }
    if (
      new Date(course.startTime).getTime() >= end.getTime() ||
      courseEnd(course).getTime() <= start.getTime()
    ) {
      throw localized(
        BadRequestException,
        'error.reservation.courseSlotMismatch',
      );
    }
    return course;
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

  // `requester` is the member asking, when the request comes from the API:
  // a booking made for a course must be for one of their courses.
  async create(
    createReservationInput: CreateReservationInput,
    now: Date = new Date(),
    requester?: SessionUser | null,
  ): Promise<Reservation> {
    const { aircraft_id } = createReservationInput;
    const start = new Date(createReservationInput.start_time);
    const end = new Date(createReservationInput.end_time);

    const { reservation, aircraft, user, instructor, cents } =
      await this.inTransaction(async (manager) => {
        let userId = createReservationInput.user_id;
        let instructorId = createReservationInput.instructor_id ?? null;

        // A booking made for a course is flown by its student with its
        // instructor, whoever of the two asks for it.
        const course =
          createReservationInput.course_id != null
            ? await this.courseToBook(
                manager,
                createReservationInput.course_id,
                start,
                end,
                requester,
              )
            : null;
        if (course) {
          userId = course.student.id;
          instructorId = course.instructor.id;
        }

        const { aircraft, user, instructor } = await this.assertBookable(
          manager,
          {
            aircraftId: aircraft_id,
            userId,
            instructorId,
            start,
            end,
          },
          now,
        );
        const cents =
          priceCents(aircraft.hourly_cost, start, end) +
          instructorFeeCents(instructor !== null, start, end);

        const reservation = await manager.save(
          Reservation,
          manager.create(Reservation, {
            aircraft,
            user,
            instructor,
            reservation_date: createReservationInput.reservation_date,
            start_time: start,
            end_time: end,
            purpose: createReservationInput.purpose,
            flight_category: instructor
              ? INSTRUCTION_FLIGHT_CATEGORY
              : createReservationInput.flight_category,
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
        if (course) {
          await manager.update(
            InstructionCourse,
            { id: course.id },
            { reservation: { id: reservation.id } },
          );
        }
        return { reservation, aircraft, user, instructor, cents };
      });

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
    if (instructor) {
      await this.tellInstructor('Booked', instructor, reservation);
    }

    return reservation;
  }

  // The instructor of a booking is told what the pilot is told: when it is
  // made, changed and cancelled, by a notification and an e-mail in their
  // own language.
  private async tellInstructor(
    notice: InstructorNotice,
    instructor: User,
    booking: {
      user: User;
      aircraft: Aircraft;
      start_time: Date | string;
      end_time: Date | string;
    },
  ): Promise<void> {
    const language: Language = languageOf(instructor);
    const details = {
      student: fullName(booking.user),
      registration: booking.aircraft.registration_number,
      date: mailDate(booking.start_time, language),
    };
    const message = translate(
      language,
      `notification.instruction${notice}ForInstructor`,
      details,
    );
    const subject = translate(language, `mail.instruction${notice}.subject`);
    await this.announce(`Instruction ${notice} e-mail`, () =>
      this.mailerService.sendMail(
        instructor.email,
        subject,
        message,
        'instruction-booking',
        {
          title: subject,
          greeting: translate(language, 'mail.instruction.greeting', {
            name: instructor.first_name,
          }),
          message,
          start_label: translate(language, 'mail.instruction.start'),
          end_label: translate(language, 'mail.instruction.end'),
          start_time: mailDate(booking.start_time, language),
          end_time: mailDate(booking.end_time, language),
        },
        language,
      ),
    );
    await this.announce(`Instruction ${notice} notification`, () =>
      this.notificationService.create({
        user_id: instructor.id,
        notification_type: `INSTRUCTION_${notice.toUpperCase()}`,
        notification_date: new Date(),
        message,
        is_read: false,
      }),
    );
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
      // Left out, the instructor stays; null, the flight is made without one.
      const previousInstructor = reservation.instructor ?? null;
      const instructorId =
        updateReservationInput.instructor_id === undefined
          ? (previousInstructor?.id ?? null)
          : updateReservationInput.instructor_id;
      const instructorChanged =
        Number(instructorId ?? 0) !== Number(previousInstructor?.id ?? 0);
      const flightCategory =
        instructorId != null
          ? INSTRUCTION_FLIGHT_CATEGORY
          : (updateReservationInput.flight_category ??
            reservation.flight_category);

      const slotChanged =
        start.getTime() !== previous.start.getTime() ||
        end.getTime() !== previous.end.getTime() ||
        aircraftId !== Number(reservation.aircraft.id);

      let aircraft = reservation.aircraft;
      let instructor = previousInstructor;
      let movedCents = 0;
      if (slotChanged || instructorChanged) {
        ({ aircraft, instructor } = await this.assertBookable(
          manager,
          {
            aircraftId,
            userId: reservation.user.id,
            instructorId,
            start,
            end,
            excludeReservationId: reservation.id,
          },
          now,
        ));
      }

      const feeBefore = instructorFeeCents(
        previousInstructor !== null,
        previous.start,
        previous.end,
      );
      const feeAfter = instructorFeeCents(instructor !== null, start, end);

      if (slotChanged || feeAfter !== feeBefore) {
        if (reservation.charged_amount == null) {
          throw localized(
            BadRequestException,
            'error.reservation.priceUnknown',
          );
        }
        // A new slot is priced again; otherwise only the instructor's part
        // of the price moves, whatever the rate of the aircraft has become.
        const newCents = slotChanged
          ? priceCents(aircraft.hourly_cost, start, end) + feeAfter
          : toCents(reservation.charged_amount) - feeBefore + feeAfter;
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

      if (instructorChanged) {
        reservation.instructor = instructor;
        // The course this booking was made for was the previous
        // instructor's: it no longer has an aircraft.
        await manager.update(
          InstructionCourse,
          { reservation: { id: reservation.id } },
          { reservation: null },
        );
      }

      const saved = await manager.save(Reservation, reservation);
      return { saved, previous, movedCents, previousInstructor };
    });

    const { saved, previous, movedCents, previousInstructor } = changed;
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

    // An instructor who leaves the booking is told it is off for them, one
    // who joins it that it is on, one who stays that it changed.
    const stays = sameMember(previousInstructor?.id, saved.instructor?.id);
    if (previousInstructor && !stays) {
      await this.tellInstructor('Cancelled', previousInstructor, {
        user,
        aircraft: saved.aircraft,
        start_time: previous.start,
        end_time: previous.end,
      });
    }
    if (saved.instructor) {
      await this.tellInstructor(
        stays ? 'Changed' : 'Booked',
        saved.instructor,
        saved,
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

      // The course this booking was made for stays, without an aircraft.
      await manager.update(
        InstructionCourse,
        { reservation: { id } },
        { reservation: null },
      );

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
    // When the instructor declines, the pilot is told who cancelled.
    const instructor = reservation.instructor ?? null;
    const declined =
      instructor !== null && sameMember(actor.userId, instructor.id);
    await this.announce('Booking cancellation notification', () =>
      this.notificationService.create({
        user_id: user.id,
        notification_type: 'RESERVATION_CANCELLED',
        notification_date: new Date(),
        message: declined
          ? translate(language, 'notification.instructionDeclined', {
              instructor: fullName(instructor),
              registration,
              date: mailDate(reservation.start_time, language),
            })
          : translate(language, 'notification.reservationCancelled', {
              registration,
            }),
        is_read: false,
      }),
    );
    if (instructor) {
      await this.tellInstructor('Cancelled', instructor, reservation);
    }
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

  // Who flies a reservation: its holder and its instructor, or null if it
  // does not exist.
  async findCrewIds(
    id: number,
  ): Promise<{ ownerId: number | null; instructorId: number | null } | null> {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
      relations: ['user', 'instructor'],
    });
    return reservation
      ? {
          ownerId: reservation.user?.id ?? null,
          instructorId: reservation.instructor?.id ?? null,
        }
      : null;
  }

  // The bookings a member instructs.
  async findInstructorReservations(
    instructorId: number,
  ): Promise<Reservation[]> {
    return this.reservationRepository.find({
      where: { instructor: { id: instructorId } },
      relations: ['aircraft', 'user', 'instructor', 'flights'],
      order: { start_time: 'ASC' },
    });
  }

  // Who can be chosen as the instructor of a booking.
  async findBookableInstructors(): Promise<User[]> {
    return this.userRepository.find({
      where: { role: { role_name: ROLE_INSTRUCTOR }, is_active: true },
      relations: ['role'],
      order: { last_name: 'ASC', first_name: 'ASC' },
    });
  }

  // Whether a member may book without an instructor: they hold a licence
  // the club accepts, valid until `until`.
  async mayBookAlone(
    userId: number,
    until: Date = new Date(),
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['licenses'],
    });
    const settings = (await this.administrationService.findAll())?.[0];
    return hasValidLicence(user?.licenses, settings?.pilotLicenses, until);
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
    queryBuilder.leftJoinAndSelect('reservation.instructor', 'instructor');
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
