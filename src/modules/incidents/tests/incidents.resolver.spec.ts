import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsResolver } from '../incidents.resolver';
import { IncidentsService } from '../incidents.service';
import { Incident } from '../entity/incidents.entity';

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
    expect(await resolver.create(dto)).toBe(inc);
    service.updateIncident.mockResolvedValue(inc);
    expect(await resolver.update(4, dto)).toBe(inc);
    service.deleteIncident.mockResolvedValue(true);
    expect(await resolver.delete('5')).toBe(true);
  });

  it('recentIncidents calls service', async () => {
    const arr = [{ id: 6 }];
    service.getRecentIncidents.mockResolvedValue(arr);
    expect(await resolver.recentIncidents(2)).toBe(arr);
  });
});
