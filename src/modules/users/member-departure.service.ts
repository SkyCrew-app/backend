import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Not, Repository } from 'typeorm';
import { User } from './entity/users.entity';
import { UsersService } from './users.service';
import { ReservationsService } from '../reservations/reservations.service';
import {
  Reservation,
  ReservationStatus,
} from '../reservations/entity/reservations.entity';
import { InstructionCourse } from '../instruction-courses/entity/instruction-courses.entity';
import { CourseStatus } from '../instruction-courses/enum/course-status.enum';

// Courses still to come: the ones a deactivation leaves without one of
// their two participants.
const PENDING_COURSE_STATUSES = [
  CourseStatus.SCHEDULED,
  CourseStatus.IN_PROGRESS,
];

export interface MemberCommitments {
  upcomingReservations: Reservation[];
  // Bookings of other members on which this member is the instructor.
  upcomingInstructionReservations: Reservation[];
  upcomingCourses: InstructionCourse[];
}

export interface MemberDeactivation {
  user: User;
  // Bookings still to come when the administrator asked.
  upcomingReservations: number;
  cancelledReservations: number;
  refundedAmount: number;
  // Bookings the cancellation rules refused (a flight already closed…):
  // they are left as they are, for the administrator to settle.
  keptReservationIds: number[];
  // The same for the bookings of other members this member was to instruct:
  // cancelled ones are refunded to their student.
  upcomingInstructionReservations: number;
  cancelledInstructionReservations: number;
  refundedToStudents: number;
  upcomingCourses: number;
}

const cents = (amount: number | string | null | undefined): number =>
  Math.round(Number(amount ?? 0) * 100);

// What a member still has ahead of them at the club, and what happens to it
// when their account is closed.
@Injectable()
export class MemberDepartureService {
  private readonly logger = new Logger(MemberDepartureService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly reservationsService: ReservationsService,
    @InjectRepository(Reservation)
    private readonly reservations: Repository<Reservation>,
    @InjectRepository(InstructionCourse)
    private readonly courses: Repository<InstructionCourse>,
  ) {}

  // Bookings that have not started yet, and courses still to be given or
  // taken, soonest first.
  async commitmentsOf(
    userId: number,
    now: Date = new Date(),
  ): Promise<MemberCommitments> {
    const toCome = {
      start_time: MoreThan(now),
      status: Not(ReservationStatus.CANCELLED),
    };
    const upcomingReservations = await this.reservations.find({
      where: { ...toCome, user: { id: userId } },
      relations: ['aircraft', 'user', 'instructor'],
      order: { start_time: 'ASC' },
    });
    const upcomingInstructionReservations = await this.reservations.find({
      where: { ...toCome, instructor: { id: userId } },
      relations: ['aircraft', 'user', 'instructor'],
      order: { start_time: 'ASC' },
    });

    const pending = {
      startTime: MoreThan(now),
      status: In(PENDING_COURSE_STATUSES),
    };
    const upcomingCourses = await this.courses.find({
      where: [
        { ...pending, student: { id: userId } },
        { ...pending, instructor: { id: userId } },
      ],
      relations: ['instructor', 'student'],
      order: { startTime: 'ASC' },
    });

    return {
      upcomingReservations,
      upcomingInstructionReservations,
      upcomingCourses,
    };
  }

  // Closes the account. With `cancelUpcomingBookings`, every booking still
  // to come is first cancelled through the ordinary cancellation: whoever
  // paid gets back exactly what the booking cost, once, and is told. That
  // covers the member's own bookings and those they were to instruct (the
  // student is refunded). Without it the bookings stay and are only counted.
  // Courses are only counted: they are the instructor's to reschedule.
  async deactivate(
    userId: number,
    cancelUpcomingBookings: boolean,
    now: Date = new Date(),
  ): Promise<MemberDeactivation> {
    // Refused before anything is cancelled (unknown member, last
    // administrator).
    await this.usersService.assertMayDeactivate(userId);

    const {
      upcomingReservations,
      upcomingInstructionReservations,
      upcomingCourses,
    } = await this.commitmentsOf(userId, now);

    const keptReservationIds: number[] = [];
    const cancelAll = async (bookings: Reservation[]) => {
      let cancelled = 0;
      let refundedCents = 0;
      for (const reservation of bookings) {
        try {
          await this.reservationsService.delete(
            reservation.id,
            { isAdmin: true },
            now,
          );
          cancelled += 1;
          refundedCents += cents(reservation.charged_amount);
        } catch (error) {
          keptReservationIds.push(reservation.id);
          this.logger.warn(
            `Booking ${reservation.id} of member ${userId} was not cancelled: ${(error as Error)?.message}`,
          );
        }
      }
      return { cancelled, refundedCents };
    };

    const none = { cancelled: 0, refundedCents: 0 };
    const own = cancelUpcomingBookings
      ? await cancelAll(upcomingReservations)
      : none;
    const instructed = cancelUpcomingBookings
      ? await cancelAll(upcomingInstructionReservations)
      : none;

    const user = await this.usersService.setActive(userId, false);

    return {
      user,
      upcomingReservations: upcomingReservations.length,
      cancelledReservations: own.cancelled,
      refundedAmount: own.refundedCents / 100,
      keptReservationIds,
      upcomingInstructionReservations: upcomingInstructionReservations.length,
      cancelledInstructionReservations: instructed.cancelled,
      refundedToStudents: instructed.refundedCents / 100,
      upcomingCourses: upcomingCourses.length,
    };
  }
}
