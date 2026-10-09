import { Args, Int, Mutation, Query } from '@nestjs/graphql';
import { Resolver } from '@nestjs/graphql';
import { IncidentsService } from './incidents.service';
import { Incident } from './entity/incidents.entity';
import { UpdateIncidentInput } from './dto/update-incident.input';
import { CreateIncidentInput } from './dto/create-incident.input';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  assertSelfOrRole,
  hasRole,
  isAdmin,
  ROLE_TECHNICIAN,
  SessionUser,
} from '../../common/auth/access';

@Resolver()
export class IncidentsResolver {
  constructor(private readonly incidentService: IncidentsService) {}

  @Query(() => [Incident], { name: 'getAllIncidents' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
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
    // A member reports in their own name. Technicians and administrators
    // may record an incident on behalf of someone else.
    const reportsForOthers =
      isAdmin(currentUser) || hasRole(currentUser, ROLE_TECHNICIAN);

    return this.incidentService.createIncident({
      ...incident,
      user_id: reportsForOthers ? incident.user_id : currentUser.id,
    });
  }

  @Mutation(() => Incident, { name: 'updateIncident' })
  @UseGuards(JwtAuthGuard)
  async update(
    @Args('id') id: number,
    @Args('incident') incident: UpdateIncidentInput,
    @CurrentUser() currentUser?: SessionUser,
  ) {
    // Its author, technicians and administrators may update an incident.
    const existing = await this.incidentService.getIncident(id);
    if (!existing) {
      throw new NotFoundException('Incident not found');
    }
    assertSelfOrRole(currentUser, existing.user?.id, ROLE_TECHNICIAN);

    return this.incidentService.updateIncident(id, incident);
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
