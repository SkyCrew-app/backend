import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { ReservationsService } from './reservations.service';
import { Reservation } from './entity/reservations.entity';
import { CreateReservationInput } from './dto/create-reservation.input';
import { UpdateReservationInput } from './dto/update-reservation.input';

@Resolver(() => Reservation)
export class ReservationsResolver {
  constructor(private readonly reservationService: ReservationsService) {}

  @Mutation(() => Reservation)
  async createReservation(
    @Args('createReservationInput')
    createReservationInput: CreateReservationInput,
  ): Promise<Reservation> {
    return this.reservationService.create(createReservationInput);
  }

  @Mutation(() => Reservation)
  async updateReservation(
    @Args('updateReservationInput')
    updateReservationInput: UpdateReservationInput,
  ): Promise<Reservation> {
    return this.reservationService.update(updateReservationInput);
  }

  @Mutation(() => Boolean)
  async deleteReservation(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    await this.reservationService.delete(id);
    return true;
  }

  @Query(() => [Reservation], { name: 'reservations' })
  findAll() {
    return this.reservationService.findAll();
  }

  @Query(() => Reservation, { name: 'reservation' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.reservationService.findOne(id);
  }

  @Query(() => [Reservation], { name: 'filteredReservations' })
  async getFilteredReservations(
    @Args('start_date', { type: () => String, nullable: true })
    startDate: string,
    @Args('end_date', { type: () => String, nullable: true }) endDate: string,
  ): Promise<Reservation[]> {
    return this.reservationService.findFilteredReservations(startDate, endDate);
  }

  @Query(() => [Reservation], { name: 'userReservations' })
  async getUserReservations(
    @Args('userId', { type: () => Int }) userId: number,
  ): Promise<Reservation[]> {
    return this.reservationService.findUserReservations(userId);
  }
}
