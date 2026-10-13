import {
  Resolver,
  Query,
  Mutation,
  Args,
  Int,
  ResolveField,
  Parent,
  Context,
} from '@nestjs/graphql';
import { ReservationsService } from './reservations.service';
import { Reservation } from './entity/reservations.entity';
import { ReservationTemplate } from './entity/reservation-template.entity';
import { CreateReservationInput } from './dto/create-reservation.input';
import { UpdateReservationInput } from './dto/update-reservation.input';
import { CreateReservationTemplateInput } from './dto/create-reservation-template.input';
import { UpdateReservationTemplateInput } from './dto/update-reservation-template.input';
import { NotFoundException, UseFilters, UseGuards } from '@nestjs/common';
import { LocalizedExceptionFilter } from '../../common/i18n/localized-exception.filter';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entity/users.entity';
import { assertSelfOrRole, isAdmin } from '../../common/auth/access';
import { FlightsService } from '../flights/flights.service';
import { Flight } from '../flights/entity/flights.entity';
import { AdminActionsService } from '../../common/admin-actions/admin-actions.service';
import { ADMIN_ACTION } from '../../common/admin-actions/admin-actions';

// Who may read whose flights, asked once per request and per pilot.
const flightReaders = new WeakMap<object, Map<number, Promise<boolean>>>();

@Resolver(() => Reservation)
@UseFilters(LocalizedExceptionFilter)
export class ReservationsResolver {
  constructor(
    private readonly reservationService: ReservationsService,
    private readonly flightsService: FlightsService,
    private readonly adminActions: AdminActionsService,
  ) {}

  // An administrator changing or cancelling the booking of another member
  // leaves a line in the administrators' log.
  private actsForAnotherMember(
    currentUser: User | undefined,
    ownerId: number | null,
  ): boolean {
    return (
      isAdmin(currentUser) &&
      ownerId != null &&
      Number(ownerId) !== Number(currentUser?.id)
    );
  }

  private traceBooking(
    currentUser: User | undefined,
    action: string,
    booking: Partial<Reservation> | null | undefined,
    reservationId: number,
    ownerId: number | null,
    facts: Record<string, unknown> = {},
  ): Promise<void> {
    const holder = [booking?.user?.first_name, booking?.user?.last_name]
      .filter(Boolean)
      .join(' ');
    return this.adminActions.record(
      currentUser,
      action,
      {
        type: 'reservation',
        id: reservationId,
        label:
          [booking?.aircraft?.registration_number, holder]
            .filter(Boolean)
            .join(', ') || null,
      },
      {
        memberId: ownerId,
        start: booking?.start_time ?? null,
        end: booking?.end_time ?? null,
        ...facts,
      },
    );
  }

  // The schedule is public (who, which aircraft, when); the flights of a
  // booking are not. They are read like any flight: by the pilot, an
  // administrator, an instructor who teaches that pilot or the instructor
  // of the booking. Anyone else gets an empty list, so the schedule itself
  // still loads.
  @ResolveField(() => [Flight], { name: 'flights', nullable: true })
  async flights(
    @Parent() reservation: Reservation,
    @CurrentUser() currentUser?: User,
    @Context() context?: object,
  ): Promise<Flight[] | null> {
    if (!reservation.flights?.length) {
      return reservation.flights ?? null;
    }
    // The crew comes with the booking on every list; it is looked up
    // otherwise.
    const crew =
      reservation.user?.id != null
        ? {
            ownerId: reservation.user.id,
            instructorId: reservation.instructor?.id ?? null,
          }
        : await this.reservationService.findCrewIds(reservation.id);
    const pilotId = crew?.ownerId ?? null;

    // The instructor of this booking reads its flights, and only its.
    if (
      crew?.instructorId != null &&
      Number(crew.instructorId) === Number(currentUser?.id)
    ) {
      return (await this.flightsService.canReadFlightsOf(
        pilotId,
        currentUser,
        crew.instructorId,
      ))
        ? reservation.flights
        : [];
    }

    const asked =
      (context && flightReaders.get(context)) ??
      new Map<number, Promise<boolean>>();
    if (context && !flightReaders.has(context)) {
      flightReaders.set(context, asked);
    }
    const key = Number(pilotId);
    if (!asked.has(key)) {
      asked.set(
        key,
        this.flightsService.canReadFlightsOf(pilotId, currentUser),
      );
    }
    return (await asked.get(key)) ? reservation.flights : [];
  }

  // Everyone sees the schedule, but only the holder of a reservation or an
  // administrator may change it.
  private async assertHolder(
    currentUser: User | undefined,
    reservationId: number,
  ): Promise<number> {
    const ownerId = await this.reservationService.findOwnerId(reservationId);

    if (ownerId === null) {
      throw new NotFoundException('Réservation introuvable');
    }

    assertSelfOrRole(currentUser, ownerId);
    return ownerId;
  }

  // A booking is cancelled by its holder, by an administrator, or by its
  // instructor, who declines it.
  private async assertHolderOrInstructor(
    currentUser: User | undefined,
    reservationId: number,
  ): Promise<number> {
    const crew = await this.reservationService.findCrewIds(reservationId);

    if (!crew || crew.ownerId === null) {
      throw new NotFoundException('Réservation introuvable');
    }
    if (
      crew.instructorId !== null &&
      currentUser != null &&
      Number(crew.instructorId) === Number(currentUser.id)
    ) {
      return crew.ownerId;
    }

    assertSelfOrRole(currentUser, crew.ownerId);
    return crew.ownerId;
  }

  @Mutation(() => Reservation)
  @UseGuards(JwtAuthGuard)
  async createReservation(
    @Args('createReservationInput')
    createReservationInput: CreateReservationInput,
    @CurrentUser() currentUser?: User,
  ): Promise<Reservation> {
    // A member books, and is charged, for themselves. Only an administrator
    // may book on behalf of someone else. The one exception is a booking
    // made for a course (course_id): the service then takes the student and
    // the instructor from the course, once it has checked the caller is one
    // of the two.
    return this.reservationService.create(
      {
        ...createReservationInput,
        user_id: isAdmin(currentUser)
          ? createReservationInput.user_id
          : currentUser.id,
      },
      new Date(),
      currentUser,
    );
  }

  @Mutation(() => Reservation)
  @UseGuards(JwtAuthGuard)
  async updateReservation(
    @Args('updateReservationInput')
    updateReservationInput: UpdateReservationInput,
    @CurrentUser() currentUser?: User,
  ): Promise<Reservation> {
    const ownerId = await this.assertHolder(
      currentUser,
      updateReservationInput.id,
    );

    // Handing a reservation over to another user is an administrator action.
    const input = { ...updateReservationInput };
    if (!isAdmin(currentUser)) {
      delete input.user_id;
    }

    const updated = await this.reservationService.update(input);
    if (this.actsForAnotherMember(currentUser, ownerId)) {
      await this.traceBooking(
        currentUser,
        ADMIN_ACTION.RESERVATION_CHANGED_FOR_MEMBER,
        updated,
        updateReservationInput.id,
        ownerId,
      );
    }
    return updated;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteReservation(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser?: User,
  ): Promise<boolean> {
    const ownerId = await this.assertHolderOrInstructor(currentUser, id);
    // Read before it is gone, for the trace only.
    const forAnother = this.actsForAnotherMember(currentUser, ownerId);
    let booking: Reservation | null = null;
    if (forAnother) {
      try {
        booking = await this.reservationService.findOne(id);
      } catch {
        booking = null;
      }
    }
    // After the start time, cancelling is an administrator's decision.
    await this.reservationService.delete(id, {
      isAdmin: isAdmin(currentUser),
      userId: currentUser?.id,
    });
    if (forAnother) {
      await this.traceBooking(
        currentUser,
        ADMIN_ACTION.RESERVATION_CANCELLED_FOR_MEMBER,
        booking,
        id,
        ownerId,
        { refundedAmount: Number(booking?.charged_amount ?? 0) },
      );
    }
    return true;
  }

  // The bookings the caller instructs.
  @Query(() => [Reservation], { name: 'myInstructionReservations' })
  @UseGuards(JwtAuthGuard)
  getMyInstructionReservations(
    @CurrentUser() currentUser: User,
  ): Promise<Reservation[]> {
    return this.reservationService.findInstructorReservations(currentUser.id);
  }

  // The members who can be chosen as the instructor of a booking.
  @Query(() => [User], { name: 'bookableInstructors' })
  @UseGuards(JwtAuthGuard)
  getBookableInstructors(): Promise<User[]> {
    return this.reservationService.findBookableInstructors();
  }

  // Whether the caller may book without an instructor (a valid licence
  // until `until`, now by default). The booking itself decides again.
  @Query(() => Boolean, { name: 'mayBookWithoutInstructor' })
  @UseGuards(JwtAuthGuard)
  getMayBookWithoutInstructor(
    @CurrentUser() currentUser: User,
    @Args('until', { type: () => Date, nullable: true }) until?: Date,
  ): Promise<boolean> {
    return this.reservationService.mayBookAlone(
      currentUser.id,
      until ?? new Date(),
    );
  }

  @Query(() => [Reservation], { name: 'reservations' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  findAll() {
    return this.reservationService.findAll();
  }

  @Query(() => Reservation, { name: 'reservation' })
  @UseGuards(JwtAuthGuard)
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.reservationService.findOne(id);
  }

  @Query(() => [Reservation], { name: 'filteredReservations' })
  @UseGuards(JwtAuthGuard)
  async getFilteredReservations(
    @Args('start_date', { type: () => String, nullable: true })
    startDate: string,
    @Args('end_date', { type: () => String, nullable: true }) endDate: string,
  ): Promise<Reservation[]> {
    return this.reservationService.findFilteredReservations(startDate, endDate);
  }

  @Query(() => [Reservation], { name: 'userReservations' })
  @UseGuards(JwtAuthGuard)
  async getUserReservations(
    @Args('userId', { type: () => Int }) userId: number,
  ): Promise<Reservation[]> {
    return this.reservationService.findUserReservations(userId);
  }

  @Query(() => [Reservation], { name: 'recentReservations' })
  @UseGuards(JwtAuthGuard)
  async getRecentReservations(
    @Args('limit', { type: () => Int }) limit: number,
  ): Promise<Reservation[]> {
    return this.reservationService.findRecentReservations(limit);
  }

  // === Reservation Templates ===

  @Query(() => [ReservationTemplate], { name: 'myReservationTemplates' })
  @UseGuards(JwtAuthGuard)
  async getMyReservationTemplates(
    @CurrentUser() user: User,
  ): Promise<ReservationTemplate[]> {
    return this.reservationService.getUserTemplates(user.id);
  }

  @Mutation(() => ReservationTemplate)
  @UseGuards(JwtAuthGuard)
  async createReservationTemplate(
    @CurrentUser() user: User,
    @Args('input', { type: () => CreateReservationTemplateInput })
    input: CreateReservationTemplateInput,
  ): Promise<ReservationTemplate> {
    return this.reservationService.createTemplate(user.id, input);
  }

  @Mutation(() => ReservationTemplate)
  @UseGuards(JwtAuthGuard)
  async updateReservationTemplate(
    @CurrentUser() user: User,
    @Args('input', { type: () => UpdateReservationTemplateInput })
    input: UpdateReservationTemplateInput,
  ): Promise<ReservationTemplate> {
    return this.reservationService.updateTemplate(user.id, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteReservationTemplate(
    @CurrentUser() user: User,
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    return this.reservationService.deleteTemplate(user.id, id);
  }
}
