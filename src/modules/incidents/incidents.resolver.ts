import { Args, Mutation, Query } from '@nestjs/graphql';
import { Resolver } from '@nestjs/graphql';
import { IncidentsService } from './incidents.service';
import { Incident } from './entity/incidents.entity';
import { UpdateIncidentInput } from './dto/update-incident.input';
import { CreateIncidentInput } from './dto/create-incident.input';

@Resolver()
export class IncidentsResolver {
  constructor(private readonly incidentService: IncidentsService) {}

  @Query(() => [Incident], { name: 'getAllIncidents' })
  findAll() {
    return this.incidentService.getAllIncidents();
  }

  @Query(() => Incident, { name: 'getIncident' })
  findOne(@Args('id') id: number) {
    return this.incidentService.getIncident(id);
  }

  @Query(() => [Incident], { name: 'getIncidentsByStatus' })
  findByStatus(@Args('status') status: string) {
    return this.incidentService.getIncidentsByStatus(status);
  }

  @Query(() => [Incident], { name: 'getIncidentsByPriority' })
  findByPriority(@Args('priority') priority: string) {
    return this.incidentService.getIncidentsByPriority(priority);
  }

  @Query(() => [Incident], { name: 'getIncidentsByCategory' })
  findByCategory(@Args('category') category: string) {
    return this.incidentService.getIncidentsByCategory(category);
  }

  @Query(() => [Incident], { name: 'getIncidentsByFlight' })
  findByFlight(@Args('flight') flight: string) {
    return this.incidentService.getIncidentsByFlight(flight);
  }

  @Mutation(() => Incident, { name: 'createIncident' })
  create(@Args('incident') incident: CreateIncidentInput) {
    return this.incidentService.createIncident(incident);
  }

  @Mutation(() => Incident, { name: 'updateIncident' })
  update(
    @Args('id') id: number,
    @Args('incident') incident: UpdateIncidentInput,
  ) {
    return this.incidentService.updateIncident(id, incident);
  }

  @Mutation(() => Boolean, { name: 'deleteIncident' })
  delete(@Args('id') id: string) {
    return this.incidentService.deleteIncident(id);
  }
}
