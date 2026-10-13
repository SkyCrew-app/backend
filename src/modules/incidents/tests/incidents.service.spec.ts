import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentsService } from '../incidents.service';
import { Incident } from '../entity/incidents.entity';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { Flight } from '../../flights/entity/flights.entity';
import { User } from '../../users/entity/users.entity';
import { Reservation } from '../../reservations/entity/reservations.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { AvailabilityStatus } from '../../aircraft/entity/aircraft.entity';
import { GROUNDING_SEVERITIES, incidentLevel } from '../incident-rules';

const pilot = { id: 30, email: 'p@example.com', role: { role_name: 'Pilote' } };
const stranger = {
  id: 31,
  email: 's@example.com',
  role: { role_name: 'Pilote' },
};
const technician = {
  id: 6,
  email: 't@example.com',
  role: { role_name: 'Technicien' },
};
const admin = { id: 1, email: 'a@example.com', role: 'Administrateur' };

const relations = [
  'aircraft',
  'flight',
  'flight.user',
  'flight.instructor',
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
  let reservationRepo: { find: jest.Mock };
  let notifications: { create: jest.Mock };

  beforeEach(async () => {
    incidentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    aircraftRepo = { findOneBy: jest.fn(), update: jest.fn() };
    flightRepo = { findOneBy: jest.fn(), findOne: jest.fn() };
    userRepo = {
      findOneBy: jest.fn(async ({ id }) => ({ id })),
      find: jest.fn().mockResolvedValue([]),
    };
    reservationRepo = { find: jest.fn().mockResolvedValue([]) };
    notifications = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: getRepositoryToken(Incident), useValue: incidentRepo },
        { provide: getRepositoryToken(Aircraft), useValue: aircraftRepo },
        { provide: getRepositoryToken(Flight), useValue: flightRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Reservation), useValue: reservationRepo },
        { provide: NotificationsService, useValue: notifications },
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

  describe('createIncident', () => {
    const aircraft = () => ({
      id: 10,
      registration_number: 'F-GABC',
      availability_status: AvailabilityStatus.AVAILABLE,
    });
    const input = (values: object = {}) =>
      ({
        aircraft_id: 10,
        flight_id: 20,
        user_id: 30,
        incident_date: new Date('2021-01-01'),
        description: 'desc',
        damage_report: 'dmg',
        corrective_actions: 'fix',
        severity_level: 'low',
        status: 'Ouvert',
        priority: 'medium',
        category: 'mechanical',
        ...values,
      }) as any;

    beforeEach(() => {
      flightRepo.findOne.mockResolvedValue({
        id: 20,
        user: { id: 30 },
        reservation: { id: 40, aircraft: aircraft() },
      });
      incidentRepo.save.mockImplementation(async (incident) => ({
        id: 99,
        ...incident,
      }));
    });

    it('records the incident of a member on their own flight', async () => {
      const res = await service.createIncident(input(), pilot);

      expect(res).toMatchObject({
        id: 99,
        description: 'desc',
        aircraft: { id: 10 },
        flight: { id: 20 },
        user: { id: 30 },
      });
      // A minor incident leaves the aircraft in service.
      expect(aircraftRepo.update).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('always starts open, whatever status is sent', async () => {
      const res = await service.createIncident(
        input({ status: 'Résolu' }),
        pilot,
      );

      expect(res.status).toBe('Ouvert');
    });

    it('is reported in the name of the caller, unless staff records it for someone', async () => {
      flightRepo.findOne.mockResolvedValue({ id: 20, user: { id: 31 } });
      aircraftRepo.findOneBy.mockResolvedValue(aircraft());

      const own = await service.createIncident(
        input({ user_id: 30 }),
        stranger,
      );
      expect(own.user).toEqual({ id: 31 });

      const forSomeone = await service.createIncident(
        input({ user_id: 30 }),
        technician,
      );
      expect(forSomeone.user).toEqual({ id: 30 });
    });

    it("refuses a member reporting on someone else's flight", async () => {
      await expect(service.createIncident(input(), stranger)).rejects.toThrow(
        ForbiddenException,
      );
      expect(incidentRepo.save).not.toHaveBeenCalled();
    });

    it('takes the aircraft of the flight, not the one sent', async () => {
      const res = await service.createIncident(
        input({ aircraft_id: 77 }),
        pilot,
      );

      expect(res.aircraft).toMatchObject({ id: 10 });
      expect(aircraftRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('refuses an unknown flight, aircraft or severity', async () => {
      await expect(
        service.createIncident(input({ severity_level: 'whatever' }), pilot),
      ).rejects.toThrow(BadRequestException);

      flightRepo.findOne.mockResolvedValue({ id: 20, user: { id: 30 } });
      aircraftRepo.findOneBy.mockResolvedValue(null);
      await expect(service.createIncident(input(), pilot)).rejects.toThrow(
        NotFoundException,
      );

      flightRepo.findOne.mockResolvedValue(null);
      await expect(service.createIncident(input(), pilot)).rejects.toThrow(
        NotFoundException,
      );
      expect(incidentRepo.save).not.toHaveBeenCalled();
    });

    it('grounds the aircraft on a severe incident and tells who has it booked', async () => {
      reservationRepo.find.mockResolvedValue([
        {
          id: 51,
          start_time: new Date(2026, 9, 20, 10, 0),
          user: { id: 8, language: 'fr' },
        },
        {
          id: 52,
          start_time: new Date(2026, 9, 21, 10, 0),
          user: { id: 9, language: 'en' },
        },
      ]);
      userRepo.find.mockResolvedValue([{ id: 1, language: 'fr' }]);

      await service.createIncident(input({ severity_level: 'high' }), pilot);

      expect(aircraftRepo.update).toHaveBeenCalledWith(10, {
        availability_status: AvailabilityStatus.UNAVAILABLE,
      });
      // Upcoming bookings of that aircraft only.
      expect(reservationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ aircraft: { id: 10 } }),
        }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 8,
          notification_type: 'AIRCRAFT_GROUNDED',
          message: expect.stringContaining(
            "L'avion F-GABC est immobilisé à la suite d'un incident. Votre réservation N°51",
          ),
        }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 9,
          message: expect.stringContaining(
            'Aircraft F-GABC has been grounded after an incident. Your booking No. 52',
          ),
        }),
      );
      // The staff who can put it back is told too.
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 1,
          message: expect.stringContaining('incident N°99'),
        }),
      );
    });

    it('keeps the report when telling people fails', async () => {
      reservationRepo.find.mockRejectedValue(new Error('down'));

      await expect(
        service.createIncident(input({ severity_level: 'Élevée' }), pilot),
      ).resolves.toMatchObject({ id: 99 });
      expect(aircraftRepo.update).toHaveBeenCalled();
    });

    it('grounds on the top severity only', () => {
      expect(GROUNDING_SEVERITIES).toEqual(['high']);
      expect(incidentLevel(' Critique ')).toBe('high');
      expect(incidentLevel('moyenne')).toBe('medium');
      expect(incidentLevel('')).toBeNull();
    });
  });

  describe('updateIncident', () => {
    const stored = (values: object = {}) =>
      ({
        id: 5,
        status: 'Ouvert',
        severity_level: 'low',
        description: 'desc',
        user: { id: 30 },
        aircraft: {
          id: 10,
          registration_number: 'F-GABC',
          availability_status: AvailabilityStatus.AVAILABLE,
        },
        flight: { id: 20 },
        ...values,
      }) as any;

    beforeEach(() => {
      incidentRepo.save.mockImplementation(async (incident) => incident);
    });

    it('lets the author correct what they reported', async () => {
      incidentRepo.findOne.mockResolvedValue(stored());

      const res = await service.updateIncident(
        5,
        // The form sends the current status and ids back unchanged.
        { id: 5, description: 'plus précis', status: 'Ouvert', user_id: 30 },
        pilot,
      );

      expect(res).toMatchObject({
        description: 'plus précis',
        status: 'Ouvert',
      });
    });

    // This test used to assert that the status sent was simply saved.
    it.each([
      ['the status', { status: 'Résolu' }],
      ['who it is attributed to', { user_id: 31 }],
      ['its aircraft', { aircraft_id: 11 }],
      ['its flight', { flight_id: 21 }],
    ])('refuses the author changing %s', async (_label, changes) => {
      incidentRepo.findOne.mockResolvedValue(stored());

      await expect(
        service.updateIncident(5, { id: 5, ...changes } as any, pilot),
      ).rejects.toThrow(ForbiddenException);
      expect(incidentRepo.save).not.toHaveBeenCalled();
    });

    it('refuses another member', async () => {
      incidentRepo.findOne.mockResolvedValue(stored());

      await expect(
        service.updateIncident(5, { id: 5, description: 'x' }, stranger),
      ).rejects.toThrow(ForbiddenException);
      expect(incidentRepo.save).not.toHaveBeenCalled();
    });

    it.each([
      ['a technician', technician],
      ['an administrator', admin],
    ])('lets %s resolve and reassign it', async (_label, caller) => {
      incidentRepo.findOne.mockResolvedValue(stored());

      const res = await service.updateIncident(
        5,
        { id: 5, status: 'Résolu', user_id: 31 },
        caller,
      );

      expect(res.status).toBe('Résolu');
      expect(res.resolved_at).toBeInstanceOf(Date);
      expect(res.resolved_by).toEqual({ id: caller.id });
      expect(res.user).toEqual({ id: 31 });
    });

    it('refuses a status the follow-up does not know, even from staff', async () => {
      incidentRepo.findOne.mockResolvedValue(stored());

      await expect(
        service.updateIncident(5, { id: 5, status: 'closed' }, technician),
      ).rejects.toThrow(BadRequestException);
      expect(incidentRepo.save).not.toHaveBeenCalled();
    });

    it('grounds the aircraft when the incident becomes severe', async () => {
      incidentRepo.findOne.mockResolvedValue(stored());

      await service.updateIncident(5, { id: 5, severity_level: 'high' }, pilot);

      expect(aircraftRepo.update).toHaveBeenCalledWith(10, {
        availability_status: AvailabilityStatus.UNAVAILABLE,
      });
    });

    it('does not ground again an aircraft someone put back in service', async () => {
      incidentRepo.findOne.mockResolvedValue(
        stored({ severity_level: 'high' }),
      );

      await service.updateIncident(5, { id: 5, description: 'suite' }, pilot);

      expect(aircraftRepo.update).not.toHaveBeenCalled();
    });

    it('should throw when updating missing incident', async () => {
      incidentRepo.findOne.mockResolvedValue(undefined);
      await expect(
        service.updateIncident(7, { id: 7 } as any, admin),
      ).rejects.toThrow('Incident with id 7 not found');
    });
  });

  // Deleting used to be open to every technician and administrator, with
  // no look at the incident (rewritten with the rule).
  describe('deleteIncident', () => {
    const open = (changes: Partial<Incident> = {}) =>
      ({
        id: 8,
        status: 'Ouvert',
        user: { id: pilot.id },
        resolved_by: null,
        resolved_at: null,
        resolution_note: null,
        ...changes,
      }) as Incident;

    beforeEach(() => {
      incidentRepo.delete.mockResolvedValue({ affected: 1 } as any);
    });

    it('lets an administrator delete any incident', async () => {
      incidentRepo.findOne.mockResolvedValue(
        open({ status: 'Résolu', resolved_by: { id: 6 } as any }),
      );

      expect(await service.deleteIncident('8', admin)).toBe(true);
      expect(incidentRepo.delete).toHaveBeenCalledWith(8);
    });

    it('lets the author withdraw a report nobody has taken up', async () => {
      incidentRepo.findOne.mockResolvedValue(open());

      expect(await service.deleteIncident('8', pilot)).toBe(true);
    });

    it.each([
      ['in progress', { status: 'En cours' }],
      ['resolved', { status: 'Résolu', resolved_by: { id: 6 } }],
      ['annotated by the staff', { resolution_note: 'Pièce commandée' }],
    ])(
      'refuses the author once the incident is %s',
      async (_label, changes) => {
        incidentRepo.findOne.mockResolvedValue(open(changes as any));

        await expect(service.deleteIncident('8', pilot)).rejects.toThrow(
          ForbiddenException,
        );
        expect(incidentRepo.delete).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['another member', stranger],
      ['a technician', technician],
      ['nobody', undefined],
    ])('refuses %s, even on an open incident', async (_label, caller) => {
      incidentRepo.findOne.mockResolvedValue(open());

      await expect(service.deleteIncident('8', caller)).rejects.toThrow(
        'Seul un administrateur peut supprimer un incident',
      );
      expect(incidentRepo.delete).not.toHaveBeenCalled();
    });

    it('says so when there was nothing to delete', async () => {
      incidentRepo.findOne.mockResolvedValue(null);

      expect(await service.deleteIncident('8', admin)).toBe(false);
      expect(incidentRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('announceGrounding', () => {
    it('words the notifications for a non-conforming audit', async () => {
      reservationRepo.find.mockResolvedValue([
        {
          id: 77,
          start_time: new Date('2026-11-02T09:00:00Z'),
          user: { id: 30, language: 'fr' },
        },
      ]);
      userRepo.find.mockResolvedValue([{ id: 1, language: 'en' }]);

      await service.announceGrounding(
        { id: 2, registration_number: 'F-GABC' },
        { kind: 'audit', id: 14 },
      );

      const messages = notifications.create.mock.calls.map(([notification]) => [
        notification.user_id,
        notification.message,
      ]);
      expect(messages[0][0]).toBe(30);
      expect(messages[0][1]).toContain(
        "immobilisé à la suite d'un audit de sécurité non conforme",
      );
      expect(messages[0][1]).toContain('N°77');
      expect(messages[1]).toEqual([
        1,
        'Aircraft F-GABC has been grounded after safety audit No. 14, found non-conforming. Upcoming bookings affected: 1.',
      ]);
    });

    it('never throws: a failed notification does not undo the grounding', async () => {
      reservationRepo.find.mockRejectedValue(new Error('down'));

      await expect(
        service.announceGrounding(
          { id: 2, registration_number: 'F-GABC' },
          { kind: 'incident', id: 3 },
        ),
      ).resolves.toBeUndefined();
    });
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
