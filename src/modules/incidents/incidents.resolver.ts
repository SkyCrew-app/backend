import { Args, Int, Mutation, Query } from '@nestjs/graphql';
import { Resolver } from '@nestjs/graphql';
import { IncidentsService } from './incidents.service';
import { Incident } from './entity/incidents.entity';
import { UpdateIncidentInput } from './dto/update-incident.input';
import { CreateIncidentInput } from './dto/create-incident.input';
import { UseFilters, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SessionUser } from '../../common/auth/access';
import { LocalizedExceptionFilter } from '../../common/i18n/localized-exception.filter';

@Resolver()
@UseFilters(LocalizedExceptionFilter)
export class IncidentsResolver {
  constructor(private readonly incidentService: IncidentsService) {}

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
    return this.incidentService.updateIncident(id, incident, currentUser);
  }

  // Following an incident up (status and resolution note) is the job of
  // the staff: technicians and administrators.
  @Mutation(() => Incident, { name: 'updateIncidentStatus' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Technicien', 'Administrateur')
  updateStatus(
    @Args('id', { type: () => Int }) id: number,
    @Args('status') status: string,
    @Args('resolution_note', { type: () => String, nullable: true })
    resolutionNote: string | null,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    return this.incidentService.updateIncidentStatus(
      id,
      status,
      resolutionNote,
      currentUser.id,
    );
  }

  @Mutation(() => Boolean, { name: 'deleteIncident' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Technicien', 'Administrateur')
  delete(@Args('id') id: string) {
    return this.incidentService.deleteIncident(id);
  }

  @Query(() => [Incident], { name: 'recentIncidents' })
  @UseGuards(JwtAuthGuard)
  recentIncidents(@Args('limit', { type: () => Int }) limit: number) {
    return this.incidentService.getRecentIncidents(limit);
  }
}
