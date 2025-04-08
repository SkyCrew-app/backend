import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from './entity/incidents.entity';
import { CreateIncidentInput } from './dto/create-incident.input';
import { UpdateIncidentInput } from './dto/update-incident.input';
import { Aircraft } from '../aircraft/entity/aircraft.entity';
import { Flight } from '../flights/entity/flights.entity';
import { User } from '../users/entity/users.entity';

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(Aircraft)
    private readonly aircraftRepository: Repository<Aircraft>,
    @InjectRepository(Flight)
    private readonly flightRepository: Repository<Flight>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getAllIncidents(): Promise<Incident[]> {
    return this.incidentRepository.find();
  }

  async getIncident(id: number): Promise<Incident> {
    return this.incidentRepository.findOne({ where: { id: id } });
  }

  async getIncidentsByStatus(status: string): Promise<Incident[]> {
    return this.incidentRepository.find({ where: { status } });
  }

  async getIncidentsByPriority(priority: string): Promise<Incident[]> {
    return this.incidentRepository.find({ where: { priority } });
  }

  async getIncidentsByCategory(category: string): Promise<Incident[]> {
    return this.incidentRepository.find({ where: { category } });
  }

  async getIncidentsByFlight(flight: string): Promise<Incident[]> {
    return this.incidentRepository.find({
      where: { flight: { id: Number(flight) } },
    });
  }

  async createIncident(
    createIncidentInput: CreateIncidentInput,
  ): Promise<Incident> {
    const incident = new Incident();
    incident.incident_date = createIncidentInput.incident_date;
    incident.description = createIncidentInput.description;
    incident.damage_report = createIncidentInput.damage_report;
    incident.corrective_actions = createIncidentInput.corrective_actions;
    incident.severity_level = createIncidentInput.severity_level;
    incident.status = createIncidentInput.status;
    incident.priority = createIncidentInput.priority;
    incident.category = createIncidentInput.category;

    incident.aircraft = await this.aircraftRepository.findOneBy({
      id: createIncidentInput.aircraft_id,
    });
    incident.flight = await this.flightRepository.findOneBy({
      id: createIncidentInput.flight_id,
    });
    incident.user = await this.userRepository.findOneBy({
      id: createIncidentInput.user_id,
    });

    return this.incidentRepository.save(incident);
  }

  async updateIncident(
    id: number,
    updateIncidentInput: UpdateIncidentInput,
  ): Promise<Incident> {
    const incident = await this.incidentRepository.findOne({ where: { id } });
    if (!incident) {
      throw new Error(`Incident with id ${id} not found`);
    }

    incident.incident_date =
      updateIncidentInput.incident_date ?? incident.incident_date;
    incident.description =
      updateIncidentInput.description ?? incident.description;
    incident.damage_report =
      updateIncidentInput.damage_report ?? incident.damage_report;
    incident.corrective_actions =
      updateIncidentInput.corrective_actions ?? incident.corrective_actions;
    incident.severity_level =
      updateIncidentInput.severity_level ?? incident.severity_level;
    incident.status = updateIncidentInput.status ?? incident.status;
    incident.priority = updateIncidentInput.priority ?? incident.priority;
    incident.category = updateIncidentInput.category ?? incident.category;

    if (updateIncidentInput.aircraft_id) {
      incident.aircraft = await this.aircraftRepository.findOneBy({
        id: updateIncidentInput.aircraft_id,
      });
    }
    if (updateIncidentInput.flight_id) {
      incident.flight = await this.flightRepository.findOneBy({
        id: updateIncidentInput.flight_id,
      });
    }
    if (updateIncidentInput.user_id) {
      incident.user = await this.userRepository.findOneBy({
        id: updateIncidentInput.user_id,
      });
    }

    return this.incidentRepository.save(incident);
  }

  async deleteIncident(id: string): Promise<boolean> {
    await this.incidentRepository.delete(id);
    return true;
  }

  async getRecentIncidents(limit: number): Promise<Incident[]> {
    return this.incidentRepository.find({
      order: { incident_date: 'DESC' },
      take: limit,
    });
  }
}
