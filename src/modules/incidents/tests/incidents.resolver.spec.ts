import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsResolver } from '../incidents.resolver';
import { IncidentsService } from '../incidents.service';
import { Incident } from '../entity/incidents.entity';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { AdminActionsService } from '../../../common/admin-actions/admin-actions.service';
import { FlightsService } from '../../flights/flights.service';

const admin = { id: 1, email: 'admin@example.com', role: 'Administrateur' };
const technician = {
  id: 6,
  email: 'tech@example.com',
  role: { role_name: 'Technicien' },
};
const author = {
  id: 3,
  email: 'author@example.com',
  role: { role_name: 'Pilote' },
};
const stranger = {
  id: 7,
  email: 'stranger@example.com',
  role: { role_name: 'Pilote' },
};

describe('IncidentsResolver', () => {
  let resolver: IncidentsResolver;
  let service: any;
  let flights: { canReadFlightsOf: jest.Mock };
  let trace: { record: jest.Mock };

  beforeEach(async () => {
    service = {
      getAllIncidents: jest.fn(),
      getIncident: jest.fn(),
      getIncidentsByStatus: jest.fn(),
      getIncidentsByPriority: jest.fn(),
      getIncidentsByCategory: jest.fn(),
      getIncidentsByFlight: jest.fn(),
      createIncident: jest.fn(),
      updateIncident: jest.fn(),
      updateIncidentStatus: jest.fn(),
      deleteIncident: jest.fn(),
      getRecentIncidents: jest.fn(),
      pilotIdOfFlight: jest.fn(),
    };
    flights = { canReadFlightsOf: jest.fn() };
    trace = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AdminActionsService, useValue: trace },
        { provide: FlightsService, useValue: flights },
        IncidentsResolver,
        { provide: IncidentsService, useValue: service },
      ],
    }).compile();

    resolver = module.get<IncidentsResolver>(IncidentsResolver);
  });

  it('findAll calls service', async () => {
    const arr: Incident[] = [];
    service.getAllIncidents.mockResolvedValue(arr);
    expect(await resolver.findAll()).toBe(arr);
  });

  it('findOne calls service', async () => {
    const inc = { id: 1 } as Incident;
    service.getIncident.mockResolvedValue(inc);
    expect(await resolver.findOne(1)).toBe(inc);
  });

  it('filters queries call service', async () => {
    const arr = [{ id: 2 }] as Incident[];
    service.getIncidentsByStatus.mockResolvedValue(arr);
    expect(await resolver.findByStatus('open')).toBe(arr);
    service.getIncidentsByPriority.mockResolvedValue(arr);
    expect(await resolver.findByPriority('high')).toBe(arr);
    service.getIncidentsByCategory.mockResolvedValue(arr);
    expect(await resolver.findByCategory('cat')).toBe(arr);
    service.getIncidentsByFlight.mockResolvedValue(arr);
    expect(await resolver.findByFlight('3')).toBe(arr);
  });

  it('CRUD mutations call service', async () => {
    const dto = { id: 4 } as any;
    const inc = { id: 4 } as Incident;
    service.createIncident.mockResolvedValue(inc);
    expect(await resolver.create(dto, admin)).toBe(inc);
    service.getIncident.mockResolvedValue({ id: 4, user: { id: 3 } });
    service.updateIncident.mockResolvedValue(inc);
    expect(await resolver.update(4, dto, admin)).toBe(inc);
    service.deleteIncident.mockResolvedValue(true);
    expect(await resolver.delete('5', admin)).toBe(true);
    // The caller goes to the service, which decides who may delete.
    expect(service.deleteIncident).toHaveBeenCalledWith('5', admin);
  });

  // The flight of an incident used to be returned to every member, with its
  // route, hours and remarks.
  describe('flight of an incident', () => {
    const flight = { id: 9, origin_icao: 'LFPG', user: { id: 3 } } as any;
    const incident = { id: 4, flight } as Incident;

    it('is given to whoever may read that flight', async () => {
      flights.canReadFlightsOf.mockResolvedValue(true);

      await expect(resolver.flight(incident, author, {})).resolves.toBe(flight);
      expect(flights.canReadFlightsOf).toHaveBeenCalledWith(3, author);
    });

    it.each([
      ['another member', stranger],
      ['a technician', technician],
    ])('is withheld from %s', async (_label, caller) => {
      flights.canReadFlightsOf.mockResolvedValue(false);

      await expect(resolver.flight(incident, caller, {})).resolves.toBeNull();
    });

    it('is given to the instructor who was on board, whatever they teach', async () => {
      flights.canReadFlightsOf.mockResolvedValue(false);
      const onBoard = { id: 20, role: { role_name: 'Instructeur' } } as any;
      const instructed = { ...flight, instructor: { id: 20 } };
      const booked = { ...flight, reservation: { instructor: { id: 20 } } };

      await expect(
        resolver.flight({ id: 4, flight: instructed } as any, onBoard, {}),
      ).resolves.toBe(instructed);
      await expect(
        resolver.flight({ id: 4, flight: booked } as any, onBoard, {}),
      ).resolves.toBe(booked);
      // Another instructor still goes through the ordinary rule.
      await expect(
        resolver.flight(
          { id: 4, flight: instructed } as any,
          { id: 21, role: { role_name: 'Instructeur' } } as any,
          {},
        ),
      ).resolves.toBeNull();
    });

    it('looks the pilot up when the flight came without one', async () => {
      service.pilotIdOfFlight.mockResolvedValue(3);
      flights.canReadFlightsOf.mockResolvedValue(false);

      await expect(
        resolver.flight({ id: 4, flight: { id: 9 } } as any, stranger, {}),
      ).resolves.toBeNull();
      expect(service.pilotIdOfFlight).toHaveBeenCalledWith(9);
      expect(flights.canReadFlightsOf).toHaveBeenCalledWith(3, stranger);
    });

    it('asks once per pilot within a request', async () => {
      flights.canReadFlightsOf.mockResolvedValue(true);
      const request = {};

      await resolver.flight(incident, author, request);
      await resolver.flight({ id: 5, flight } as Incident, author, request);

      expect(flights.canReadFlightsOf).toHaveBeenCalledTimes(1);
    });

    it('tells whoever reads the incident that a flight exists, even when it is withheld', async () => {
      flights.canReadFlightsOf.mockResolvedValue(false);

      await expect(
        resolver.flight(incident, technician, {}),
      ).resolves.toBeNull();
      expect(resolver.hasFlight(incident)).toBe(true);
      expect(resolver.hasFlight({ id: 4, flight: null } as any)).toBe(false);
      expect(resolver.hasFlight({ id: 4 } as any)).toBe(false);
    });

    it('is null for an incident without a flight', async () => {
      await expect(
        resolver.flight({ id: 4, flight: null } as any, author, {}),
      ).resolves.toBeNull();
      expect(flights.canReadFlightsOf).not.toHaveBeenCalled();
    });
  });

  describe('trace', () => {
    it('records a status change, with the status before and after', async () => {
      service.getIncident.mockResolvedValue({ id: 4, status: 'Ouvert' });
      service.updateIncidentStatus.mockResolvedValue({
        id: 4,
        status: 'Résolu',
      });

      await resolver.updateStatus(4, 'Résolu', null, technician);

      expect(trace.record).toHaveBeenCalledWith(
        technician,
        'incident.status_changed',
        { type: 'incident', id: 4 },
        { from: 'Ouvert', to: 'Résolu' },
      );
    });

    it('records nothing when the status did not change', async () => {
      service.getIncident.mockResolvedValue({ id: 4, status: 'Ouvert' });
      service.updateIncidentStatus.mockResolvedValue({
        id: 4,
        status: 'Ouvert',
      });

      await resolver.updateStatus(4, 'Ouvert', 'note', technician);

      expect(trace.record).not.toHaveBeenCalled();
    });

    it('records a deletion by an administrator, not a withdrawal by its author', async () => {
      service.deleteIncident.mockResolvedValue(true);

      await resolver.delete('5', author);
      expect(trace.record).not.toHaveBeenCalled();

      await resolver.delete('5', admin);
      expect(trace.record).toHaveBeenCalledWith(admin, 'incident.deleted', {
        type: 'incident',
        id: '5',
      });
    });
  });

  it('recentIncidents calls service', async () => {
    const arr = [{ id: 6 }];
    service.getRecentIncidents.mockResolvedValue(arr);
    expect(await resolver.recentIncidents(2)).toBe(arr);
  });
  // Who may report and change what is decided by the service, which knows
  // the incident: the resolver hands it the caller.
  describe('authorization', () => {
    const report = { aircraft_id: 2, user_id: 3, description: 'x' } as any;

    it.each([
      ['a member', stranger],
      ['a technician', technician],
    ])('reports an incident with %s as the caller', async (_label, caller) => {
      service.createIncident.mockResolvedValue({});

      await resolver.create(report, caller);

      expect(service.createIncident).toHaveBeenCalledWith(report, caller);
    });

    it.each([
      ['its author', author],
      ['a technician', technician],
      ['an administrator', admin],
      ['another member', stranger],
    ])('updates an incident with %s as the caller', async (_label, caller) => {
      service.updateIncident.mockResolvedValue({ id: 4 });
      const changes = { description: 'y' } as any;

      await expect(resolver.update(4, changes, caller)).resolves.toEqual({
        id: 4,
      });
      expect(service.updateIncident).toHaveBeenCalledWith(4, changes, caller);
    });
  });

  describe('follow-up', () => {
    it('changes the status in the name of the caller', async () => {
      const updated = { id: 4, status: 'Résolu' };
      service.updateIncidentStatus.mockResolvedValue(updated);

      await expect(
        resolver.updateStatus(4, 'Résolu', 'Pièce changée', technician),
      ).resolves.toBe(updated);
      expect(service.updateIncidentStatus).toHaveBeenCalledWith(
        4,
        'Résolu',
        'Pièce changée',
        6,
      );
    });

    it('reserves the follow-up and the full list to the staff', () => {
      expect(
        Reflect.getMetadata(
          ROLES_KEY,
          IncidentsResolver.prototype.updateStatus,
        ),
      ).toEqual(['Technicien', 'Administrateur']);
      expect(
        Reflect.getMetadata(ROLES_KEY, IncidentsResolver.prototype.findAll),
      ).toEqual(['Administrateur', 'Technicien']);
    });
  });
});
