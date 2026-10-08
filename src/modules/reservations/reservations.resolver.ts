import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { ReservationsService } from './reservations.service';
import { Reservation } from './entity/reservations.entity';
import { ReservationTemplate } from './entity/reservation-template.entity';
import { CreateReservationInput } from './dto/create-reservation.input';
import { UpdateReservationInput } from './dto/update-reservation.input';
import { CreateReservationTemplateInput } from './dto/create-reservation-template.input';
import { UpdateReservationTemplateInput } from './dto/update-reservation-template.input';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entity/users.entity';

@Resolver(() => Reservation)
export class ReservationsResolver {
  constructor(private readonly reservationService: ReservationsService) {}

  @Mutation(() => Reservation)
  @UseGuards(JwtAuthGuard)
  async createReservation(
    @Args('createReservationInput')
    createReservationInput: CreateReservationInput,
  ): Promise<Reservation> {
    return this.reservationService.create(createReservationInput);
  }

  @Mutation(() => Reservation)
  @UseGuards(JwtAuthGuard)
  async updateReservation(
    @Args('updateReservationInput')
    updateReservationInput: UpdateReservationInput,
  ): Promise<Reservation> {
    return this.reservationService.update(updateReservationInput);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteReservation(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    await this.reservationService.delete(id);
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
