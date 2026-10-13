import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentsService } from '../incidents.service';
import { Incident } from '../entity/incidents.entity';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { Flight } from '../../flights/entity/flights.entity';
import { User } from '../../users/entity/users.entity';

const relations = [
  'aircraft',
  'flight',
  'flight.reservation',
  'user',
  'resolved_by',
];

describe('IncidentsService', () => {
  let service: IncidentsService;
  let incidentRepo: Partial<Record<keyof Repository<Incident>, jest.Mock>>;
  let aircraftRepo: Partial<Record<keyof Repository<Aircraft>, jest.Mock>>;
  let flightRepo: Partial<Record<keyof Repository<Flight>, jest.Mock>>;
  let userRepo: Partial<Record<keyof Repository<User>, jest.Mock>>;

  beforeEach(async () => {
    incidentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    aircraftRepo = { findOneBy: jest.fn() };
    flightRepo = { findOneBy: jest.fn() };
    userRepo = { findOneBy: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: getRepositoryToken(Incident), useValue: incidentRepo },
        { provide: getRepositoryToken(Aircraft), useValue: aircraftRepo },
        { provide: getRepositoryToken(Flight), useValue: flightRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<IncidentsService>(IncidentsService);
  });

  it('should list all incidents', async () => {
    const list = [{ id: 1 }] as Incident[];
    incidentRepo.find.mockResolvedValue(list as any);
    expect(await service.getAllIncidents()).toBe(list);
    expect(incidentRepo.find).toHaveBeenCalledWith({
      relations,
      order: { incident_date: 'DESC' },
    });
  });

  it('should get one incident', async () => {
    const inc = { id: 2 } as Incident;
    incidentRepo.findOne.mockResolvedValue(inc as any);
    expect(await service.getIncident(2)).toBe(inc);
    expect(incidentRepo.findOne).toHaveBeenCalledWith({
      where: { id: 2 },
      relations,
    });
  });

  it('should filter by status, priority, category, flight', async () => {
    const by = [{ id: 3 }] as Incident[];
    incidentRepo.find.mockResolvedValue(by as any);
    expect(await service.getIncidentsByStatus('OPEN')).toBe(by);
    expect(incidentRepo.find).toHaveBeenCalledWith({
      where: { status: 'OPEN' },
      relations,
    });
    expect(await service.getIncidentsByPriority('HIGH')).toBe(by);
    expect(incidentRepo.find).toHaveBeenLastCalledWith({
      where: { priority: 'HIGH' },
      relations,
    });
    expect(await service.getIncidentsByCategory('MECHANICAL')).toBe(by);
    expect(incidentRepo.find).toHaveBeenLastCalledWith({
      where: { category: 'MECHANICAL' },
      relations,
    });
    expect(await service.getIncidentsByFlight('5')).toBe(by);
    expect(incidentRepo.find).toHaveBeenLastCalledWith({
      where: { flight: { id: 5 } },
      relations,
    });
  });

  it('should create an incident', async () => {
    const input = {
      aircraft_id: 10,
      flight_id: 20,
      user_id: 30,
      incident_date: new Date('2021-01-01'),
      description: 'desc',
      damage_report: 'dmg',
      corrective_actions: 'fix',
      severity_level: 'low',
      status: 'open',
      priority: 'medium',
      category: 'type',
    };
    const aircraft = { id: 10 };
    const flight = { id: 20 };
    const user = { id: 30 };
    const saved = {
      id: 99,
      ...input,
      aircraft,
      flight,
      user,
    } as unknown as Incident;

    aircraftRepo.findOneBy.mockResolvedValue(aircraft as any);
    flightRepo.findOneBy.mockResolvedValue(flight as any);
    userRepo.findOneBy.mockResolvedValue(user as any);
    incidentRepo.save.mockResolvedValue(saved as any);

    const res = await service.createIncident(input as any);
    expect(aircraftRepo.findOneBy).toHaveBeenCalledWith({ id: 10 });
    expect(incidentRepo.save).toHaveBeenCalled();
    expect(res).toBe(saved);
  });

  it('should update an incident', async () => {
    const existing = { id: 5, status: 'open' } as any;
    const updatedInput = { id: 5, status: 'closed' } as any;
    const saved = { ...existing, status: 'closed' } as Incident;
    incidentRepo.findOne.mockResolvedValue(existing as any);
    incidentRepo.save.mockResolvedValue(saved as any);

    const res = await service.updateIncident(5, updatedInput);
    expect(incidentRepo.findOne).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(res).toBe(saved);
  });

  it('should throw when updating missing incident', async () => {
    incidentRepo.findOne.mockResolvedValue(undefined);
    await expect(service.updateIncident(7, { id: 7 } as any)).rejects.toThrow(
      'Incident with id 7 not found',
    );
  });

  it('should delete incident', async () => {
    incidentRepo.delete.mockResolvedValue(undefined as any);
    expect(await service.deleteIncident('8')).toBe(true);
  });

  it('should get recent incidents', async () => {
    const rec = [{ id: 6 }] as Incident[];
    incidentRepo.find.mockResolvedValue(rec as any);
    expect(await service.getRecentIncidents(2)).toBe(rec);
    expect(incidentRepo.find).toHaveBeenCalledWith({
      relations,
      order: { incident_date: 'DESC' },
      take: 2,
    });
  });

  describe('updateIncidentStatus', () => {
    it('refuses a status the follow-up does not know', async () => {
      await expect(
        service.updateIncidentStatus(5, 'closed', null, 1),
      ).rejects.toThrow(BadRequestException);
      expect(incidentRepo.save).not.toHaveBeenCalled();
    });

    it('answers not found for an unknown incident', async () => {
      incidentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateIncidentStatus(5, 'En cours', null, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('takes an incident in charge without resolving it', async () => {
      incidentRepo.findOne.mockResolvedValue({ id: 5, status: 'Ouvert' });

      await service.updateIncidentStatus(5, 'En cours', undefined, 1);

      expect(incidentRepo.save).toHaveBeenCalledWith({
        id: 5,
        status: 'En cours',
        resolved_at: null,
        resolved_by: null,
      });
    });

    it('records the note, the date and who resolved it', async () => {
      incidentRepo.findOne.mockResolvedValue({ id: 5, status: 'En cours' });

      await service.updateIncidentStatus(5, 'Résolu', '  Pièce changée  ', 9);

      const saved = incidentRepo.save.mock.calls[0][0];
      expect(saved.status).toBe('Résolu');
      expect(saved.resolution_note).toBe('Pièce changée');
      expect(saved.resolved_at).toBeInstanceOf(Date);
      expect(saved.resolved_by).toEqual({ id: 9 });
    });

    it('keeps the first resolution when only the note changes', async () => {
      const resolvedAt = new Date('2026-01-01T10:00:00Z');
      incidentRepo.findOne.mockResolvedValue({
        id: 5,
        status: 'Résolu',
        resolved_at: resolvedAt,
        resolved_by: { id: 2 },
      });

      await service.updateIncidentStatus(5, 'Résolu', 'Note corrigée', 9);

      const saved = incidentRepo.save.mock.calls[0][0];
      expect(saved.resolved_at).toBe(resolvedAt);
      expect(saved.resolved_by).toEqual({ id: 2 });
      expect(saved.resolution_note).toBe('Note corrigée');
    });

    it('clears the resolution when the incident is reopened, keeping the note', async () => {
      incidentRepo.findOne.mockResolvedValue({
        id: 5,
        status: 'Résolu',
        resolution_note: 'Pièce changée',
        resolved_at: new Date(),
        resolved_by: { id: 2 },
      });

      await service.updateIncidentStatus(5, 'Ouvert', null, 9);

      expect(incidentRepo.save).toHaveBeenCalledWith({
        id: 5,
        status: 'Ouvert',
        resolution_note: 'Pièce changée',
        resolved_at: null,
        resolved_by: null,
      });
    });
  });
});
