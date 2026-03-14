import {
  Resolver,
  Query,
  Mutation,
  Args,
  Parent,
  ResolveField,
  Int,
  Context,
} from '@nestjs/graphql';
import { FlightsService } from './flights.service';
import { Flight } from './entity/flights.entity';
import { CreateFlightInput } from './dto/create-flight.input';
import { UpdateFlightInput } from './dto/update-flight.input';
import { GenerateFlightPlanInput } from './dto/generate-flight-plan.input';
import { AirportsService } from './airports.service';
import { MetarService } from './metar.service';
import { AirportData } from './interfaces/airport.interface';
import { UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Resolver(() => Flight)
export class FlightsResolver {
  constructor(
    private readonly flightsService: FlightsService,
    private readonly airportsService: AirportsService,
    private readonly metarService: MetarService,
  ) {}

  /**
   * Build a frontend-friendly airport info object from raw AirportData.
   */
  private async buildAirportInfoForFrontend(
    airport: AirportData,
  ): Promise<string> {
    // Fetch live METAR
    const metar = await this.metarService.fetchMetarSafe(airport.icao);

    return JSON.stringify({
      ICAO: airport.icao,
      iata: airport.iata,
      name: airport.name,
      city: airport.city,
      country: airport.country,
      lat: airport.lat,
      lon: airport.lon,
      elevation: airport.elevation_ft,
      type: airport.type,
      continent: airport.continent,
      runways: (airport.runway_details ?? []).map((r) => ({
        ident: `${r.le_ident}/${r.he_ident}`,
        le_ident: r.le_ident,
        he_ident: r.he_ident,
        surface: r.surface,
        length: Math.round(r.length_ft * 0.3048),
        width: Math.round(r.width_ft * 0.3048),
        lighted: r.lighted,
      })),
      frequencies: (airport.frequencies ?? []).map((f) => ({
        name: f.type,
        frequency: Math.round(parseFloat(f.value) * 1_000_000),
      })),
      weather: {
        METAR: metar?.rawOb ?? null,
        TAF: null,
        fltcat: metar?.fltcat ?? null,
        temp: metar?.temp ?? null,
        dewp: metar?.dewp ?? null,
        wdir: metar?.wdir ?? null,
        wspd: metar?.wspd ?? null,
        wgst: metar?.wgst ?? null,
        visib: metar?.visib ?? null,
        altim: metar?.altim ?? null,
        clouds: metar?.clouds ?? [],
      },
    });
  }

  @Query(() => [Flight], { name: 'getAllFlights' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  findAll() {
    return this.flightsService.findAll();
  }

  @ResolveField(() => String, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async departure_airport_info(@Parent() flight: Flight) {
    try {
      const airport = this.airportsService.getAirportInfo(flight.origin_icao);
      return this.buildAirportInfoForFrontend(airport);
    } catch {
      return null;
    }
  }

  @ResolveField(() => String, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async arrival_airport_info(@Parent() flight: Flight) {
    try {
      const airport = this.airportsService.getAirportInfo(
        flight.destination_icao,
      );
      return this.buildAirportInfoForFrontend(airport);
    } catch {
      return null;
    }
  }

  @ResolveField(() => [String], { nullable: true })
  @UseGuards(JwtAuthGuard)
  async detailed_waypoints(@Parent() flight: Flight) {
    if (!flight.waypoints) return null;
    return this.flightsService.getDetailedWaypoints(flight.waypoints);
  }

  @Query(() => Flight, { name: 'getFlightById' })
  @UseGuards(JwtAuthGuard)
  getFlightById(@Args('id', { type: () => Int }) id: number) {
    return this.flightsService.findOne(id);
  }

  @Query(() => [Flight], { name: 'getFlightsByUser' })
  @UseGuards(JwtAuthGuard)
  getFlightsByUser(
    @Args('userId', { type: () => Int, nullable: true }) userId: number,
    @Context() context,
  ) {
    const authenticatedUserId = context.req.user.id;
    const effectiveUserId = userId ?? authenticatedUserId;

    if (
      effectiveUserId !== authenticatedUserId &&
      context.req.user.role !== 'Administrateur'
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez pas accéder aux vols d\'un autre utilisateur',
      );
    }

    return this.flightsService.getFlightsByUser(effectiveUserId);
  }

  @Mutation(() => Flight)
  @UseGuards(JwtAuthGuard)
  createFlight(
    @Args('createFlightInput') createFlightInput: CreateFlightInput,
    @Context() context,
  ) {
    createFlightInput.user_id = context.req.user.id;
    return this.flightsService.createFlightByUser(createFlightInput);
  }

  @Mutation(() => Flight)
  @UseGuards(JwtAuthGuard)
  async generateFlightPlan(
    @Args('input') input: GenerateFlightPlanInput,
    @Context() context,
  ) {
    const user_id = context.req.user.id;
    return this.flightsService.createFlightByAI(
      input.origin_icao,
      input.destination_icao,
      user_id,
      input.reservation_id,
      {
        preferred_runway_dep: input.preferred_runway_dep,
        preferred_runway_arr: input.preferred_runway_arr,
        cruise_altitude_ft: input.cruise_altitude_ft,
        departure_time: input.departure_time,
        flight_rules: input.flight_rules as 'VFR' | 'IFR' | undefined,
      },
    );
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
  removeFlight(
    @Args('id', { type: () => Number }) id: number,
    @Context() context,
  ) {
    return this.flightsService.removeFlight(id, context.req.user.id);
  }

  @Query(() => [Flight], { name: 'recentFlights' })
  @UseGuards(JwtAuthGuard)
  getRecentFlights(@Args('limit', { type: () => Int }) limit: number) {
    return this.flightsService.getRecentFlights(limit);
  }
}
