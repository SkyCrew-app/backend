import { Args, Int, Mutation, Query } from '@nestjs/graphql';
import { Resolver } from '@nestjs/graphql';
import { IncidentsService } from './incidents.service';
import { Incident } from './entity/incidents.entity';
import { UpdateIncidentInput } from './dto/update-incident.input';
import { CreateIncidentInput } from './dto/create-incident.input';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

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
  create(@Args('incident') incident: CreateIncidentInput) {
    return this.incidentService.createIncident(incident);
  }

  @Mutation(() => Incident, { name: 'updateIncident' })
  @UseGuards(JwtAuthGuard)
  update(
    @Args('id') id: number,
    @Args('incident') incident: UpdateIncidentInput,
  ) {
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
