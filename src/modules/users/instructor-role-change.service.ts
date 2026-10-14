import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Not, Repository } from 'typeorm';
import { User } from './entity/users.entity';
import { Role } from '../roles/entity/roles.entity';
import { ReservationsService } from '../reservations/reservations.service';
import {
  Reservation,
  ReservationStatus,
} from '../reservations/entity/reservations.entity';
import { InstructionCourse } from '../instruction-courses/entity/instruction-courses.entity';
import { CourseStatus } from '../instruction-courses/enum/course-status.enum';
import { CLUB_TIME_ZONE } from '../reservations/booking-rules';
import { NotificationsService } from '../notifications/notifications.service';
import { localized } from '../../common/i18n/localized-exception';
import { translate } from '../../common/i18n/translate';
import { languageOf } from '../../common/i18n/languages';
import { ROLE_ADMIN, ROLE_INSTRUCTOR } from '../../common/auth/access';

// Who may keep what after a role change: only an instructor is put on a
// booking as its instructor (see assertCanInstruct), while a course may be
// given by an instructor or an administrator (see InstructionCoursesService).
export const ROLES_THAT_INSTRUCT_BOOKINGS: readonly string[] = [
  ROLE_INSTRUCTOR,
];
export const ROLES_THAT_GIVE_COURSES: readonly string[] = [
  ROLE_INSTRUCTOR,
  ROLE_ADMIN,
];

// How many commitments the refusal names before "…".
export const COMMITMENTS_LISTED = 3;

const PENDING_COURSE_STATUSES = [
  CourseStatus.SCHEDULED,
  CourseStatus.IN_PROGRESS,
];

export interface InstructorCommitments {
  reservations: Reservation[];
  courses: InstructionCourse[];
}

export interface InstructorRoleChangeOutcome {
  cancelledInstructionReservations: number;
  refundedToStudents: number;
  cancelledCourses: number;
}

const cents = (amount: number | string | null | undefined): number =>
  Math.round(Number(amount ?? 0) * 100);

// Language-neutral: the refusal is rendered in the language of the request
// after its parameters are fixed.
const shortDate = (date: Date | string): string =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: CLUB_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date(date))
    .replace(',', '');

const nameOf = (member?: { first_name?: string; last_name?: string } | null) =>
  [member?.first_name, member?.last_name].filter(Boolean).join(' ');

// What an instructor leaving that role still has ahead of them, and what
// happens to it when the administrator confirms the change.
@Injectable()
export class InstructorRoleChangeService {
  private readonly logger = new Logger(InstructorRoleChangeService.name);

  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly notificationsService: NotificationsService,
    @InjectRepository(Reservation)
    private readonly reservations: Repository<Reservation>,
    @InjectRepository(InstructionCourse)
    private readonly courses: Repository<InstructionCourse>,
  ) {}

  // The bookings and courses the member instructs that the new role could
  // not keep, soonest first.
  async commitmentsLost(
    member: Pick<User, 'id'> & { role?: Role | null },
    newRole: Pick<Role, 'role_name'>,
    now: Date = new Date(),
  ): Promise<InstructorCommitments> {
    const before = member.role?.role_name;
    const after = newRole.role_name;
    const losesBookings =
      ROLES_THAT_INSTRUCT_BOOKINGS.includes(before) &&
      !ROLES_THAT_INSTRUCT_BOOKINGS.includes(after);
    const losesCourses =
      ROLES_THAT_GIVE_COURSES.includes(before) &&
      !ROLES_THAT_GIVE_COURSES.includes(after);

    const reservations = losesBookings
      ? await this.reservations.find({
          where: {
            instructor: { id: member.id },
            start_time: MoreThan(now),
            status: Not(ReservationStatus.CANCELLED),
          },
          relations: ['aircraft', 'user', 'instructor'],
          order: { start_time: 'ASC' },
        })
      : [];
    const courses = losesCourses
      ? await this.courses.find({
          where: {
            instructor: { id: member.id },
            startTime: MoreThan(now),
            status: In(PENDING_COURSE_STATUSES),
          },
          relations: ['instructor', 'student'],
          loadEagerRelations: false,
          order: { startTime: 'ASC' },
        })
      : [];
    return { reservations, courses };
  }

  // Called once the role change is otherwise valid. Without `confirmed`, a
  // change that would leave students with an instructor who can no longer
  // instruct them is refused, naming what is in the way. With it, those
  // bookings are cancelled through the ordinary cancellation (each student
  // refunded exactly what they paid, once) and the courses are cancelled.
  async settle(
    member: Pick<User, 'id'> & { role?: Role | null },
    newRole: Pick<Role, 'role_name'>,
    confirmed: boolean,
    now: Date = new Date(),
  ): Promise<InstructorRoleChangeOutcome> {
    const outcome: InstructorRoleChangeOutcome = {
      cancelledInstructionReservations: 0,
      refundedToStudents: 0,
      cancelledCourses: 0,
    };
    const { reservations, courses } = await this.commitmentsLost(
      member,
      newRole,
      now,
    );
    if (reservations.length === 0 && courses.length === 0) {
      return outcome;
    }

    if (!confirmed) {
      const items = [
        ...reservations.map((booking) => ({
          at: new Date(booking.start_time),
          text: `${shortDate(booking.start_time)} ${booking.aircraft?.registration_number ?? ''} – ${nameOf(booking.user)}`,
        })),
        ...courses.map((course) => ({
          at: new Date(course.startTime),
          text: `${shortDate(course.startTime)} – ${nameOf(course.student)}`,
        })),
      ].sort((a, b) => a.at.getTime() - b.at.getTime());
      const listed = items.slice(0, COMMITMENTS_LISTED).map((i) => i.text);
      if (items.length > COMMITMENTS_LISTED) {
        listed.push('…');
      }
      throw localized(ConflictException, 'error.user.instructorCommitments', {
        bookings: reservations.length,
        courses: courses.length,
        list: listed.join(' ; '),
      });
    }

    let refundedCents = 0;
    const kept: number[] = [];
    for (const booking of reservations) {
      try {
        await this.reservationsService.delete(
          booking.id,
          { isAdmin: true },
          now,
        );
        outcome.cancelledInstructionReservations += 1;
        refundedCents += cents(booking.charged_amount);
      } catch (error) {
        kept.push(booking.id);
        this.logger.warn(
          `Booking ${booking.id} instructed by member ${member.id} was not cancelled: ${(error as Error)?.message}`,
        );
      }
    }
    outcome.refundedToStudents = refundedCents / 100;
    // The role does not change while a student still has a booking with an
    // instructor who could no longer fly it.
    if (kept.length > 0) {
      throw localized(
        ConflictException,
        'error.user.instructorBookingsNotCancelled',
        { ids: kept.join(', ') },
      );
    }

    for (const course of courses) {
      await this.courses.update(
        { id: course.id },
        { status: CourseStatus.CANCELED },
      );
      outcome.cancelledCourses += 1;
      if (course.student?.id) {
        try {
          await this.notificationsService.create({
            user_id: course.student.id,
            notification_type: 'COURSE_CANCELLED',
            notification_date: new Date(),
            message: translate(
              languageOf(course.student),
              'notification.courseCancelledInstructorLeft',
              {
                instructor: nameOf(course.instructor),
                date: shortDate(course.startTime),
              },
            ),
            is_read: false,
          });
        } catch (error) {
          this.logger.warn(
            `Course cancellation notice not sent: ${(error as Error)?.message}`,
          );
        }
      }
    }
    return outcome;
  }
}
