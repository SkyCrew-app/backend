import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Not, Repository } from 'typeorm';
import {
  Incident,
  INCIDENT_STATUS_OPEN,
  INCIDENT_STATUS_RESOLVED,
  INCIDENT_STATUSES,
} from './entity/incidents.entity';
import { CreateIncidentInput } from './dto/create-incident.input';
import { UpdateIncidentInput } from './dto/update-incident.input';
import {
  Aircraft,
  AvailabilityStatus,
} from '../aircraft/entity/aircraft.entity';
import { Flight } from '../flights/entity/flights.entity';
import { User } from '../users/entity/users.entity';
import {
  Reservation,
  ReservationStatus,
} from '../reservations/entity/reservations.entity';
import { NotificationsService } from '../notifications/notifications.service';
import {
  hasRole,
  isAdmin,
  ROLE_ADMIN,
  ROLE_TECHNICIAN,
  SessionUser,
} from '../../common/auth/access';
import { formatDate, languageOf } from '../../common/i18n/languages';
import { translate } from '../../common/i18n/translate';
import { localized } from '../../common/i18n/localized-exception';
import { groundsAircraft, incidentLevel } from './incident-rules';

// Following an incident up is the job of technicians and administrators.
const isStaff = (user: SessionUser | undefined | null): boolean =>
  isAdmin(user) || hasRole(user, ROLE_TECHNICIAN);

const sameId = (a: unknown, b: unknown): boolean =>
  a != null && b != null && Number(a) === Number(b);

// Still open, and nobody of the staff has acted on it: no resolution, no
// follow-up note. (Incidents have no assignee; this is what "unassigned"
// means here.)
export const isUntouched = (incident: Incident): boolean =>
  incident.status === INCIDENT_STATUS_OPEN &&
  !incident.resolved_by &&
  !incident.resolved_at &&
  !incident.resolution_note;

// A value was sent, and it is not the current one.
const differs = (value: unknown, current: unknown): boolean =>
  value != null && !sameId(value, current);

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  private readonly incidentRelations = [
    'aircraft',
    'flight',
    // The pilot of the flight decides who may read it (Incident.flight).
    'flight.user',
    // …and so does the instructor who was on board.
    'flight.instructor',
    'flight.reservation',
    'user',
    'resolved_by',
  ] as const;

  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(Aircraft)
    private readonly aircraftRepository: Repository<Aircraft>,
    @InjectRepository(Flight)
    private readonly flightRepository: Repository<Flight>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getAllIncidents(): Promise<Incident[]> {
    return this.incidentRepository.find({
      relations: [...this.incidentRelations],
      order: { incident_date: 'DESC' },
    });
  }

  async getIncident(id: number): Promise<Incident> {
    return this.incidentRepository.findOne({
      where: { id },
      relations: [...this.incidentRelations],
    });
  }

  async getIncidentsByStatus(status: string): Promise<Incident[]> {
    return this.incidentRepository.find({
      where: { status },
      relations: [...this.incidentRelations],
    });
  }

  async getIncidentsByPriority(priority: string): Promise<Incident[]> {
    return this.incidentRepository.find({
      where: { priority },
      relations: [...this.incidentRelations],
    });
  }

  async getIncidentsByCategory(category: string): Promise<Incident[]> {
    return this.incidentRepository.find({
      where: { category },
      relations: [...this.incidentRelations],
    });
  }

  async getIncidentsByFlight(flight: string): Promise<Incident[]> {
    return this.incidentRepository.find({
      where: { flight: { id: Number(flight) } },
      relations: [...this.incidentRelations],
    });
  }

  // A member reports an incident on one of their own flights; technicians
  // and administrators record one for anybody. It always starts open, on the
  // aircraft of the flight, and a severe one grounds that aircraft.
  async createIncident(
    createIncidentInput: CreateIncidentInput,
    requester: SessionUser | undefined | null,
  ): Promise<Incident> {
    const staff = isStaff(requester);

    if (incidentLevel(createIncidentInput.severity_level) === null) {
      throw localized(BadRequestException, 'error.incident.unknownSeverity');
    }

    const flight = await this.flightRepository.findOne({
      where: { id: createIncidentInput.flight_id },
      relations: ['user', 'reservation', 'reservation.aircraft'],
    });
    if (!flight) {
      throw localized(NotFoundException, 'error.incident.flightNotFound');
    }
    if (!staff && !sameId(flight.user?.id, requester?.id)) {
      throw localized(ForbiddenException, 'error.incident.notOwnFlight');
    }

    // The aircraft is the one the flight was made on, when it is known.
    const aircraft =
      flight.reservation?.aircraft ??
      (await this.aircraftRepository.findOneBy({
        id: createIncidentInput.aircraft_id,
      }));
    if (!aircraft) {
      throw localized(NotFoundException, 'error.incident.aircraftNotFound');
    }

    const authorId = staff
      ? (createIncidentInput.user_id ?? requester?.id)
      : requester?.id;
    const author = await this.userRepository.findOneBy({ id: authorId });
    if (!author) {
      throw new NotFoundException(`User with ID ${authorId} not found`);
    }

    const incident = new Incident();
    incident.incident_date = createIncidentInput.incident_date;
    incident.description = createIncidentInput.description;
    incident.damage_report = createIncidentInput.damage_report;
    incident.corrective_actions = createIncidentInput.corrective_actions;
    incident.severity_level = createIncidentInput.severity_level;
    incident.status = INCIDENT_STATUS_OPEN;
    incident.priority = createIncidentInput.priority;
    incident.category = createIncidentInput.category;
    incident.aircraft = aircraft;
    incident.flight = flight;
    incident.user = author;

    const saved = await this.incidentRepository.save(incident);

    if (groundsAircraft(incident.severity_level)) {
      await this.groundAircraft(aircraft, saved?.id ?? incident.id);
    }

    return saved;
  }

  // Takes the aircraft out of service and tells the people concerned: the
  // members who have it booked, and the staff who can put it back.
  private async groundAircraft(
    aircraft: Aircraft,
    incidentId: number,
  ): Promise<void> {
    if (aircraft.availability_status !== AvailabilityStatus.UNAVAILABLE) {
      await this.aircraftRepository.update(aircraft.id, {
        availability_status: AvailabilityStatus.UNAVAILABLE,
      });
      aircraft.availability_status = AvailabilityStatus.UNAVAILABLE;
    }
    await this.announceGrounding(aircraft, {
      kind: 'incident',
      id: incidentId,
    });
  }

  // Tells the members who have a grounded aircraft booked, and the staff who
  // can put it back, why it is on the ground: a severe incident or a
  // non-conforming safety audit. It never throws: telling people must never
  // undo the report itself.
  async announceGrounding(
    aircraft: Pick<Aircraft, 'id' | 'registration_number'>,
    cause: { kind: 'incident' | 'audit'; id: number },
  ): Promise<void> {
    const texts =
      cause.kind === 'audit'
        ? ({
            member: 'notification.aircraftGroundedByAudit',
            staff: 'notification.aircraftGroundedByAuditStaff',
          } as const)
        : ({
            member: 'notification.aircraftGrounded',
            staff: 'notification.aircraftGroundedStaff',
          } as const);

    try {
      const registration = aircraft.registration_number;

      const upcoming = await this.reservationRepository.find({
        where: {
          aircraft: { id: aircraft.id },
          end_time: MoreThan(new Date()),
          status: Not(ReservationStatus.CANCELLED),
        },
        relations: ['user'],
      });
      for (const reservation of upcoming) {
        if (!reservation.user?.id) continue;
        const language = languageOf(reservation.user);
        await this.notificationsService.create({
          user_id: reservation.user.id,
          notification_type: 'AIRCRAFT_GROUNDED',
          notification_date: new Date(),
          message: translate(language, texts.member, {
            registration,
            reservationId: reservation.id,
            date: formatDate(language, reservation.start_time),
          }),
          is_read: false,
        });
      }

      const staff = await this.userRepository.find({
        where: { role: { role_name: In([ROLE_ADMIN, ROLE_TECHNICIAN]) } },
      });
      for (const member of staff) {
        const params = { registration, count: upcoming.length };
        await this.notificationsService.create({
          user_id: member.id,
          notification_type: 'AIRCRAFT_GROUNDED',
          notification_date: new Date(),
          message:
            texts.staff === 'notification.aircraftGroundedByAuditStaff'
              ? translate(languageOf(member), texts.staff, {
                  ...params,
                  auditId: cause.id,
                })
              : translate(languageOf(member), texts.staff, {
                  ...params,
                  incidentId: cause.id,
                }),
          is_read: false,
        });
      }
    } catch (error) {
      this.logger.error(
        `Aircraft ${aircraft.id} grounded, but notifications failed`,
        error as Error,
      );
    }
  }

  // The author corrects what they reported. The status, the member the
  // incident is attributed to, its flight and its aircraft are the staff's.
  async updateIncident(
    id: number,
    updateIncidentInput: UpdateIncidentInput,
    requester: SessionUser | undefined | null,
  ): Promise<Incident> {
    const incident = await this.incidentRepository.findOne({
      where: { id },
      relations: ['user', 'aircraft', 'flight'],
    });
    if (!incident) {
      throw new NotFoundException(`Incident with id ${id} not found`);
    }

    const staff = isStaff(requester);
    if (!staff) {
      if (!sameId(incident.user?.id, requester?.id)) {
        throw localized(ForbiddenException, 'error.incident.notAllowed');
      }
      const statusChanged =
        updateIncidentInput.status != null &&
        updateIncidentInput.status !== incident.status;
      if (
        statusChanged ||
        differs(updateIncidentInput.user_id, incident.user?.id) ||
        differs(updateIncidentInput.aircraft_id, incident.aircraft?.id) ||
        differs(updateIncidentInput.flight_id, incident.flight?.id)
      ) {
        throw localized(ForbiddenException, 'error.incident.staffOnlyFields');
      }
    }

    if (
      updateIncidentInput.severity_level != null &&
      incidentLevel(updateIncidentInput.severity_level) === null
    ) {
      throw localized(BadRequestException, 'error.incident.unknownSeverity');
    }

    const wasGrounding = groundsAircraft(incident.severity_level);
    const previousAircraftId = incident.aircraft?.id;

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
    incident.priority = updateIncidentInput.priority ?? incident.priority;
    incident.category = updateIncidentInput.category ?? incident.category;

    if (staff) {
      if (
        updateIncidentInput.status != null &&
        updateIncidentInput.status !== incident.status
      ) {
        this.assertKnownStatus(updateIncidentInput.status);
        this.applyStatus(incident, updateIncidentInput.status, requester?.id);
      }
      if (differs(updateIncidentInput.aircraft_id, incident.aircraft?.id)) {
        const aircraft = await this.aircraftRepository.findOneBy({
          id: updateIncidentInput.aircraft_id,
        });
        if (!aircraft) {
          throw localized(NotFoundException, 'error.incident.aircraftNotFound');
        }
        incident.aircraft = aircraft;
      }
      if (differs(updateIncidentInput.flight_id, incident.flight?.id)) {
        const flight = await this.flightRepository.findOneBy({
          id: updateIncidentInput.flight_id,
        });
        if (!flight) {
          throw localized(NotFoundException, 'error.incident.flightNotFound');
        }
        incident.flight = flight;
      }
      if (differs(updateIncidentInput.user_id, incident.user?.id)) {
        const author = await this.userRepository.findOneBy({
          id: updateIncidentInput.user_id,
        });
        if (!author) {
          throw new NotFoundException(
            `User with ID ${updateIncidentInput.user_id} not found`,
          );
        }
        incident.user = author;
      }
    }

    const saved = await this.incidentRepository.save(incident);

    // An incident that becomes severe, or moves to another aircraft while
    // severe, grounds the aircraft it is now about.
    if (
      incident.aircraft &&
      groundsAircraft(incident.severity_level) &&
      (!wasGrounding || differs(incident.aircraft.id, previousAircraftId))
    ) {
      await this.groundAircraft(incident.aircraft, id);
    }

    return saved;
  }

  private assertKnownStatus(status: string): void {
    if (!INCIDENT_STATUSES.includes(status)) {
      throw new BadRequestException(
        `Statut inconnu. Valeurs acceptées : ${INCIDENT_STATUSES.join(', ')}.`,
      );
    }
  }

  // Resolving records who closed the incident and when; reopening clears it.
  private applyStatus(
    incident: Incident,
    status: string,
    actorId: number | undefined,
  ): void {
    const wasResolved = incident.status === INCIDENT_STATUS_RESOLVED;
    incident.status = status;

    if (status === INCIDENT_STATUS_RESOLVED) {
      if (!wasResolved || !incident.resolved_at) {
        incident.resolved_at = new Date();
        incident.resolved_by = { id: actorId } as User;
      }
    } else {
      incident.resolved_at = null;
      incident.resolved_by = null;
    }
  }

  // Moves an incident through its follow-up. Resolving records who closed
  // it and when; reopening clears that, the note is kept.
  async updateIncidentStatus(
    id: number,
    status: string,
    resolutionNote: string | null | undefined,
    actorId: number,
  ): Promise<Incident> {
    this.assertKnownStatus(status);

    const incident = await this.incidentRepository.findOne({ where: { id } });
    if (!incident) {
      throw new NotFoundException('Incident introuvable');
    }

    if (resolutionNote != null) {
      incident.resolution_note = resolutionNote.trim() || null;
    }
    this.applyStatus(incident, status, actorId);

    await this.incidentRepository.save(incident);
    return this.getIncident(id);
  }

  // Id of the pilot of a flight, or null when the flight is unknown.
  async pilotIdOfFlight(flightId: number): Promise<number | null> {
    const flight = await this.flightRepository.findOne({
      where: { id: flightId },
      relations: ['user'],
    });
    return flight?.user?.id ?? null;
  }

  // An incident is part of the aircraft's history: only an administrator
  // deletes one. Its author may still withdraw a report nobody has taken up
  // yet (see isUntouched).
  async deleteIncident(
    id: string | number,
    requester: SessionUser | undefined | null,
  ): Promise<boolean> {
    const incident = await this.incidentRepository.findOne({
      where: { id: Number(id) },
      relations: ['user', 'resolved_by'],
    });
    if (!incident) {
      return false;
    }

    const ownUntouchedReport =
      sameId(incident.user?.id, requester?.id) && isUntouched(incident);
    if (!isAdmin(requester) && !ownUntouchedReport) {
      throw localized(ForbiddenException, 'error.incident.deleteNotAllowed');
    }

    const result = await this.incidentRepository.delete(incident.id);
    return (result?.affected ?? 0) > 0;
  }

  async getRecentIncidents(limit: number): Promise<Incident[]> {
    return this.incidentRepository.find({
      relations: [...this.incidentRelations],
      order: { incident_date: 'DESC' },
      take: limit,
    });
  }
}
