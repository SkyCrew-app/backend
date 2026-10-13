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

// Who may read whose flights, asked once per request and per pilot.
const flightReaders = new WeakMap<object, Map<number, Promise<boolean>>>();

@Resolver(() => Reservation)
@UseFilters(LocalizedExceptionFilter)
export class ReservationsResolver {
  constructor(
    private readonly reservationService: ReservationsService,
    private readonly flightsService: FlightsService,
  ) {}

  // The schedule is public (who, which aircraft, when); the flights of a
  // booking are not. They are read like any flight: by the pilot, an
  // administrator or an instructor who teaches that pilot. Anyone else gets
  // an empty list, so the schedule itself still loads.
  @ResolveField(() => [Flight], { name: 'flights', nullable: true })
  async flights(
    @Parent() reservation: Reservation,
    @CurrentUser() currentUser?: User,
    @Context() context?: object,
  ): Promise<Flight[] | null> {
    if (!reservation.flights?.length) {
      return reservation.flights ?? null;
    }
    const pilotId =
      reservation.user?.id ??
      (await this.reservationService.findOwnerId(reservation.id));

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
  // administrator may change or cancel it.
  private async assertHolder(
    currentUser: User | undefined,
    reservationId: number,
  ): Promise<void> {
    const ownerId = await this.reservationService.findOwnerId(reservationId);

    if (ownerId === null) {
      throw new NotFoundException('Réservation introuvable');
    }

    assertSelfOrRole(currentUser, ownerId);
  }

  @Mutation(() => Reservation)
  @UseGuards(JwtAuthGuard)
  async createReservation(
    @Args('createReservationInput')
    createReservationInput: CreateReservationInput,
    @CurrentUser() currentUser?: User,
  ): Promise<Reservation> {
    // A member books, and is charged, for themselves. Only an administrator
    // may book on behalf of someone else.
    return this.reservationService.create({
      ...createReservationInput,
      user_id: isAdmin(currentUser)
        ? createReservationInput.user_id
        : currentUser.id,
    });
  }

  @Mutation(() => Reservation)
  @UseGuards(JwtAuthGuard)
  async updateReservation(
    @Args('updateReservationInput')
    updateReservationInput: UpdateReservationInput,
    @CurrentUser() currentUser?: User,
  ): Promise<Reservation> {
    await this.assertHolder(currentUser, updateReservationInput.id);

    // Handing a reservation over to another user is an administrator action.
    const input = { ...updateReservationInput };
    if (!isAdmin(currentUser)) {
      delete input.user_id;
    }

    return this.reservationService.update(input);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteReservation(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser?: User,
  ): Promise<boolean> {
    await this.assertHolder(currentUser, id);
    // After the start time, cancelling is an administrator's decision.
    await this.reservationService.delete(id, {
      isAdmin: isAdmin(currentUser),
    });
    return true;
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
