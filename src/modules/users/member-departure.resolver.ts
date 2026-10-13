import {
  Args,
  Field,
  Float,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { UseFilters, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LocalizedExceptionFilter } from '../../common/i18n/localized-exception.filter';
import { ROLE_ADMIN } from '../../common/auth/access';
import { AdminActionsService } from '../../common/admin-actions/admin-actions.service';
import { ADMIN_ACTION } from '../../common/admin-actions/admin-actions';
import { User } from './entity/users.entity';
import { Reservation } from '../reservations/entity/reservations.entity';
import { InstructionCourse } from '../instruction-courses/entity/instruction-courses.entity';
import { MemberDepartureService } from './member-departure.service';

@ObjectType()
export class MemberCommitments {
  @Field(() => [Reservation])
  upcomingReservations: Reservation[];

  // Bookings of other members on which this member is the instructor.
  @Field(() => [Reservation])
  upcomingInstructionReservations: Reservation[];

  @Field(() => [InstructionCourse])
  upcomingCourses: InstructionCourse[];
}

@ObjectType()
export class MemberDeactivation {
  @Field(() => User)
  user: User;

  @Field(() => Int)
  upcomingReservations: number;

  @Field(() => Int)
  cancelledReservations: number;

  @Field(() => Float)
  refundedAmount: number;

  @Field(() => [Int])
  keptReservationIds: number[];

  @Field(() => Int)
  upcomingInstructionReservations: number;

  @Field(() => Int)
  cancelledInstructionReservations: number;

  @Field(() => Float)
  refundedToStudents: number;

  @Field(() => Int)
  upcomingCourses: number;
}

@Resolver()
@UseFilters(LocalizedExceptionFilter)
export class MemberDepartureResolver {
  constructor(
    private readonly departure: MemberDepartureService,
    private readonly adminActions: AdminActionsService,
  ) {}

  // What the administrator is shown before closing an account.
  @Query(() => MemberCommitments, { name: 'memberCommitments' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE_ADMIN)
  memberCommitments(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<MemberCommitments> {
    return this.departure.commitmentsOf(id);
  }

  // Deactivates a member and, when asked, cancels and refunds the bookings
  // they still had, in the same action.
  @Mutation(() => MemberDeactivation)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE_ADMIN)
  async deactivateMember(
    @Args('id', { type: () => Int }) id: number,
    @Args('cancelUpcomingBookings', {
      type: () => Boolean,
      defaultValue: false,
    })
    cancelUpcomingBookings: boolean,
    @CurrentUser() currentUser?: User,
  ): Promise<MemberDeactivation> {
    const result = await this.departure.deactivate(id, cancelUpcomingBookings);
    await this.adminActions.record(
      currentUser,
      ADMIN_ACTION.MEMBER_DEACTIVATED,
      {
        type: 'member',
        id,
        label: `${result.user.first_name} ${result.user.last_name}`,
      },
      {
        upcomingReservations: result.upcomingReservations,
        cancelledReservations: result.cancelledReservations,
        refundedAmount: result.refundedAmount,
        keptReservationIds: result.keptReservationIds,
        upcomingInstructionReservations: result.upcomingInstructionReservations,
        cancelledInstructionReservations:
          result.cancelledInstructionReservations,
        refundedToStudents: result.refundedToStudents,
        upcomingCourses: result.upcomingCourses,
      },
    );
    return result;
  }
}
