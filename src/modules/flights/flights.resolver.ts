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
import { GenerateFlightPlanInput } from './dto/generate-flight-plan.input';
import { AirportsService } from './airports.service';
import { MetarService } from './metar.service';
import { AirportData } from './interfaces/airport.interface';
import { UseFilters, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { isAdmin, SessionUser } from '../../common/auth/access';
import { AdminActionsService } from '../../common/admin-actions/admin-actions.service';
import {
  ADMIN_ACTION,
  AdminActionName,
} from '../../common/admin-actions/admin-actions';
import { languageOf } from '../../common/i18n/languages';
import { LocalizedExceptionFilter } from '../../common/i18n/localized-exception.filter';

// The session user, with the language they are written to.
type Member = SessionUser & { language?: string | null };

@Resolver(() => Flight)
@UseFilters(LocalizedExceptionFilter)
export class FlightsResolver {
  constructor(
    private readonly flightsService: FlightsService,
    private readonly airportsService: AirportsService,
    private readonly metarService: MetarService,
    private readonly adminActions: AdminActionsService,
  ) {}

  // The flight as it stands before an administrator touches it, for the
  // trace only: a failed lookup never stops the action itself.
  private async closedFlightBefore(
    id: number,
    currentUser?: SessionUser,
  ): Promise<Flight | null> {
    if (!isAdmin(currentUser)) {
      return null;
    }
    try {
      const flight = await this.flightsService.findOne(id);
      return flight?.closed_at ? flight : null;
    } catch {
      return null;
    }
  }

  // An administrator amending or deleting a closed flight leaves a line in
  // the administrators' log, on top of the flight's own amendment trail.
  private traceClosedFlight(
    currentUser: SessionUser | undefined,
    action: AdminActionName,
    flight: Flight,
  ): Promise<void> {
    const pilot = [flight.user?.first_name, flight.user?.last_name]
      .filter(Boolean)
      .join(' ');
    const route = [flight.origin_icao, flight.destination_icao]
      .filter(Boolean)
      .join(' → ');
    return this.adminActions.record(
      currentUser,
      action,
      {
        type: 'flight',
        id: flight.id,
        label: [route, pilot].filter(Boolean).join(', ') || null,
      },
      { memberId: flight.user?.id ?? null },
    );
  }

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

  // A flight is read by its pilot, an administrator or an instructor who
  // teaches that pilot.
  @Query(() => Flight, { name: 'getFlightById' })
  @UseGuards(JwtAuthGuard)
  getFlightById(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    return this.flightsService.findOneFor(id, currentUser);
  }

  // Base64 of a PDF summarising the flight.
  @Mutation(() => String, { name: 'exportFlightRecapPDF' })
  @UseGuards(JwtAuthGuard)
  exportFlightRecapPDF(
    @Args('flightId', { type: () => Int }) flightId: number,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<string> {
    return this.flightsService.exportRecapPdf(flightId, currentUser);
  }

  @Query(() => [Flight], { name: 'getFlightsByUser' })
  @UseGuards(JwtAuthGuard)
  async getFlightsByUser(
    @Args('userId', { type: () => Int, nullable: true }) userId: number,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    const effectiveUserId = userId ?? currentUser.id;
    await this.flightsService.assertCanReadFlightsOf(
      effectiveUserId,
      currentUser,
    );
    return this.flightsService.getFlightsByUser(effectiveUserId);
  }

  @Mutation(() => Flight)
  @UseGuards(JwtAuthGuard)
  createFlight(
    @Args('createFlightInput') createFlightInput: CreateFlightInput,
    @CurrentUser() currentUser?: Member,
  ) {
    return this.flightsService.createFlightByUser(
      createFlightInput,
      currentUser,
      languageOf(currentUser),
    );
  }

  @Mutation(() => Flight)
  @UseGuards(JwtAuthGuard)
  async generateFlightPlan(
    @Args('input') input: GenerateFlightPlanInput,
    @CurrentUser() currentUser?: Member,
  ) {
    return this.flightsService.createFlightByAI(
      input.origin_icao,
      input.destination_icao,
      currentUser.id,
      input.reservation_id,
      {
        preferred_runway_dep: input.preferred_runway_dep,
        preferred_runway_arr: input.preferred_runway_arr,
        cruise_altitude_ft: input.cruise_altitude_ft,
        departure_time: input.departure_time,
        flight_rules: input.flight_rules as 'VFR' | 'IFR' | undefined,
        language: languageOf(currentUser),
        requester: currentUser,
      },
    );
  }

  // A member closes their own flight; an administrator can amend any flight.
  @Mutation(() => Flight)
  @UseGuards(JwtAuthGuard)
  async updateFlight(
    @Args('updateFlightInput') updateFlightInput: UpdateFlightInput,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    const closedBefore = await this.closedFlightBefore(
      updateFlightInput.id,
      currentUser,
    );
    const updated = await this.flightsService.updateFlight(
      updateFlightInput.id,
      updateFlightInput,
      currentUser,
    );
    if (closedBefore) {
      await this.traceClosedFlight(
        currentUser,
        ADMIN_ACTION.FLIGHT_RECORD_AMENDED,
        closedBefore,
      );
    }
    return updated;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async removeFlight(
    @Args('id', { type: () => Number }) id: number,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    const closedBefore = await this.closedFlightBefore(id, currentUser);
    const removed = await this.flightsService.removeFlight(id, currentUser);
    if (removed && closedBefore) {
      await this.traceClosedFlight(
        currentUser,
        ADMIN_ACTION.FLIGHT_RECORD_DELETED,
        closedBefore,
      );
    }
    return removed;
  }

  // Every member's latest flights: for the administration dashboard.
  @Query(() => [Flight], { name: 'recentFlights' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  getRecentFlights(@Args('limit', { type: () => Int }) limit: number) {
    return this.flightsService.getRecentFlights(limit);
  }
}
