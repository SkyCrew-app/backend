import {
  Args,
  Context,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { IncidentsService } from './incidents.service';
import { Incident } from './entity/incidents.entity';
import { UpdateIncidentInput } from './dto/update-incident.input';
import { CreateIncidentInput } from './dto/create-incident.input';
import { UseFilters, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { isAdmin, SessionUser } from '../../common/auth/access';
import { LocalizedExceptionFilter } from '../../common/i18n/localized-exception.filter';
import { FlightsService } from '../flights/flights.service';
import { Flight } from '../flights/entity/flights.entity';
import { AdminActionsService } from '../../common/admin-actions/admin-actions.service';
import { ADMIN_ACTION } from '../../common/admin-actions/admin-actions';

// Who may read whose flights, asked once per request and per pilot.
const flightReaders = new WeakMap<object, Map<number, Promise<boolean>>>();

@Resolver(() => Incident)
@UseFilters(LocalizedExceptionFilter)
export class IncidentsResolver {
  constructor(
    private readonly incidentService: IncidentsService,
    private readonly flightsService: FlightsService,
    private readonly adminActions: AdminActionsService,
  ) {}

  // Every member reads incidents (what happened, on which aircraft). The
  // flight itself is read like any flight: by its pilot, its instructor on
  // board, an administrator or an instructor who teaches that pilot. Anyone
  // else gets no flight.
  @ResolveField(() => Flight, { name: 'flight', nullable: true })
  async flight(
    @Parent() incident: Incident,
    @CurrentUser() currentUser?: SessionUser,
    @Context() context?: object,
  ): Promise<Flight | null> {
    const flight = incident.flight;
    if (!flight) {
      return null;
    }
    // The instructor who was on board reads this flight, as they do through
    // getFlightById: this one, not the pilot's other flights.
    const instructorId =
      flight.instructor?.id ?? flight.reservation?.instructor?.id ?? null;
    if (
      instructorId != null &&
      currentUser?.id != null &&
      Number(instructorId) === Number(currentUser.id)
    ) {
      return flight;
    }
    const pilotId =
      flight.user?.id ??
      (await this.incidentService.pilotIdOfFlight(flight.id));
    if (pilotId == null) {
      return isAdmin(currentUser) ? flight : null;
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
    return (await asked.get(key)) ? flight : null;
  }

  // Whether the incident is attached to a flight, for everyone who reads
  // the incident: the screen can then tell "no flight" from "a flight you
  // may not read". Nothing about the flight itself is given.
  @ResolveField(() => Boolean, { name: 'hasFlight' })
  hasFlight(@Parent() incident: Incident): boolean {
    return incident.flight != null;
  }

  @Query(() => [Incident], { name: 'getAllIncidents' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur', 'Technicien')
  findAll() {
    return this.incidentService.getAllIncidents();
  }

  @Query(() => Incident, { name: 'getIncident' })
  @UseGuards(JwtAuthGuard)
  findOne(@Args('id') id: number) {
    return this.incidentService.getIncident(id);
  }

  @Query(() => [Incident], { name: 'getIncidentsByStatus' })
  @UseGuards(JwtAuthGuard)
  findByStatus(@Args('status') status: string) {
    return this.incidentService.getIncidentsByStatus(status);
  }

  @Query(() => [Incident], { name: 'getIncidentsByPriority' })
  @UseGuards(JwtAuthGuard)
  findByPriority(@Args('priority') priority: string) {
    return this.incidentService.getIncidentsByPriority(priority);
  }

  @Query(() => [Incident], { name: 'getIncidentsByCategory' })
  @UseGuards(JwtAuthGuard)
  findByCategory(@Args('category') category: string) {
    return this.incidentService.getIncidentsByCategory(category);
  }

  @Query(() => [Incident], { name: 'getIncidentsByFlight' })
  @UseGuards(JwtAuthGuard)
  findByFlight(@Args('flight') flight: string) {
    return this.incidentService.getIncidentsByFlight(flight);
  }

  @Mutation(() => Incident, { name: 'createIncident' })
  @UseGuards(JwtAuthGuard)
  create(
    @Args('incident') incident: CreateIncidentInput,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    // A member reports in their own name, on their own flight. Technicians
    // and administrators may record an incident on behalf of someone else.
    return this.incidentService.createIncident(incident, currentUser);
  }

  @Mutation(() => Incident, { name: 'updateIncident' })
  @UseGuards(JwtAuthGuard)
  async update(
    @Args('id') id: number,
    @Args('incident') incident: UpdateIncidentInput,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    // Its author corrects what they reported; the follow-up (status,
    // attribution) belongs to technicians and administrators.
    const previousStatus =
      incident.status != null
        ? (await this.incidentService.getIncident(id))?.status
        : undefined;
    const updated = await this.incidentService.updateIncident(
      id,
      incident,
      currentUser,
    );
    if (previousStatus !== undefined && updated?.status !== previousStatus) {
      await this.adminActions.record(
        currentUser,
        ADMIN_ACTION.INCIDENT_STATUS_CHANGED,
        { type: 'incident', id },
        { from: previousStatus, to: updated?.status },
      );
    }
    return updated;
  }

  // Following an incident up (status and resolution note) is the job of
  // the staff: technicians and administrators.
  @Mutation(() => Incident, { name: 'updateIncidentStatus' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Technicien', 'Administrateur')
  async updateStatus(
    @Args('id', { type: () => Int }) id: number,
    @Args('status') status: string,
    @Args('resolution_note', { type: () => String, nullable: true })
    resolutionNote: string | null,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    const previousStatus = (await this.incidentService.getIncident(id))?.status;
    const updated = await this.incidentService.updateIncidentStatus(
      id,
      status,
      resolutionNote,
      currentUser.id,
    );
    if (updated?.status !== previousStatus) {
      await this.adminActions.record(
        currentUser,
        ADMIN_ACTION.INCIDENT_STATUS_CHANGED,
        { type: 'incident', id },
        { from: previousStatus ?? null, to: updated?.status },
      );
    }
    return updated;
  }

  // Administrators only; the author may withdraw their own report while
  // nobody has taken it up. The rule is in the service.
  @Mutation(() => Boolean, { name: 'deleteIncident' })
  @UseGuards(JwtAuthGuard)
  async delete(
    @Args('id') id: string,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    const deleted = await this.incidentService.deleteIncident(id, currentUser);
    if (deleted && isAdmin(currentUser)) {
      await this.adminActions.record(
        currentUser,
        ADMIN_ACTION.INCIDENT_DELETED,
        { type: 'incident', id },
      );
    }
    return deleted;
  }

  @Query(() => [Incident], { name: 'recentIncidents' })
  @UseGuards(JwtAuthGuard)
  recentIncidents(@Args('limit', { type: () => Int }) limit: number) {
    return this.incidentService.getRecentIncidents(limit);
  }
}
