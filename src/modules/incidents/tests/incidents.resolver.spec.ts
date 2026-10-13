import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsResolver } from '../incidents.resolver';
import { IncidentsService } from '../incidents.service';
import { Incident } from '../entity/incidents.entity';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';

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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
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
    expect(await resolver.delete('5')).toBe(true);
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
