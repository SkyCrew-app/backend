import {
  Resolver,
  Query,
  Mutation,
  Args,
  Parent,
  ResolveField,
  Int,
} from '@nestjs/graphql';
import { FlightsService } from './flights.service';
import { Flight } from './entity/flights.entity';
import { CreateFlightInput } from './dto/create-flight.input';
import { UpdateFlightInput } from './dto/update-flight.input';
import { AirportsService } from './airports.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Resolver(() => Flight)
export class FlightsResolver {
  constructor(
    private readonly flightsService: FlightsService,
    private readonly airportsService: AirportsService,
  ) {}

  @Query(() => [Flight], { name: 'getAllFlights' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  findAll() {
    return this.flightsService.findAll();
  }

  @ResolveField(() => String, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async departure_airport_info(@Parent() flight: Flight) {
    const info = await this.airportsService.fetchAirportInfo(
      flight.origin_icao,
    );
    return info ? JSON.stringify(info) : null;
  }

  @ResolveField(() => String, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async arrival_airport_info(@Parent() flight: Flight) {
    const info = await this.airportsService.fetchAirportInfo(
      flight.destination_icao,
    );
    return info ? JSON.stringify(info) : null;
  }

  @ResolveField(() => [String], { nullable: true })
  @UseGuards(JwtAuthGuard)
  async detailed_waypoints(@Parent() flight: Flight) {
    return this.flightsService.getDetailedWaypoints(
      flight.waypoints.split(',').join(','),
    );
  }

  @Query(() => Flight, { name: 'getFlightById' })
  @UseGuards(JwtAuthGuard)
  getFlightById(@Args('id', { type: () => Int }) id: number) {
    return this.flightsService.findOne(id);
  }

  @Query(() => [Flight], { name: 'getFlightsByUser' })
  @UseGuards(JwtAuthGuard)
  getFlightsByUser(@Args('userId', { type: () => Int }) userId: number) {
    return this.flightsService.getFlightsByUser(userId);
  }

  @Mutation(() => Flight)
  createFlight(
    @Args('createFlightInput') createFlightInput: CreateFlightInput,
  ) {
    return this.flightsService.createFlightByUser(createFlightInput);
  }

  @Mutation(() => Flight)
  async generateFlightPlan(
    @Args('origin_icao') origin_icao: string,
    @Args('destination_icao') destination_icao: string,
    @Args('user_id', { type: () => Int }) user_id: number,
    @Args('reservation_id', { type: () => Int, nullable: true })
    reservation_id?: number,
  ) {
    const flight = await this.flightsService.createFlightByAI(
      origin_icao,
      destination_icao,
      user_id,
      reservation_id,
    );

    return flight;
  }

  @Mutation(() => Flight)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  updateFlight(
    @Args('updateFlightInput') updateFlightInput: UpdateFlightInput,
  ) {
    return this.flightsService.updateFlight(
      updateFlightInput.id,
      updateFlightInput,
    );
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  removeFlight(@Args('id', { type: () => Number }) id: number) {
    return this.flightsService.removeFlight(id);
  }

  @Query(() => [Flight], { name: 'recentFlights' })
  @UseGuards(JwtAuthGuard)
  getRecentFlights(@Args('limit', { type: () => Int }) limit: number) {
    return this.flightsService.getRecentFlights(limit);
  }
}
