import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { FlightsService } from '../flights.service';
import { Flight } from '../entity/flights.entity';
import { Reservation } from '../../reservations/entity/reservations.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { AirportsService } from '../airports.service';
import { NotFoundException } from '@nestjs/common';

jest.mock('axios');

describe('FlightsService', () => {
  let service: FlightsService;
  let repo: Partial<Record<keyof Repository<Flight>, jest.Mock>>;
  let resRepo: Partial<Record<keyof Repository<Reservation>, jest.Mock>>;
  let notif: Partial<NotificationsService>;
  let airports: Partial<AirportsService>;

  beforeEach(async () => {
    repo = {
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    };
    resRepo = { findOne: jest.fn(), find: jest.fn() };
    notif = { create: jest.fn() };
    airports = { getAirportInfo: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlightsService,
        { provide: getRepositoryToken(Flight), useValue: repo },
        { provide: getRepositoryToken(Reservation), useValue: resRepo },
        { provide: NotificationsService, useValue: notif },
        { provide: AirportsService, useValue: airports },
      ],
    }).compile();

    service = module.get<FlightsService>(FlightsService);
  });

  describe('createFlightByUser', () => {
    it('creates and notifies', async () => {
      const input = {
        reservation_id: 1,
        user_id: 2,
        origin_icao: 'AAA',
        destination_icao: 'BBB',
        flight_hours: 1,
        flight_type: 'X',
        number_of_passengers: 1,
        waypoints: [],
      };
      resRepo.findOne.mockResolvedValue({ id: 1 } as any);
      repo.save.mockResolvedValue({ id: 3, ...input, waypoints: '[]' });
      const res = await service.createFlightByUser(input as any);
      expect(notif.create).toHaveBeenCalledWith(
        expect.objectContaining({ notification_type: 'FLIGHT_CREATED' }),
      );
      expect(res).toEqual({ id: 3, ...input, waypoints: '[]' });
    });

    it('throws if reservation not found', async () => {
      resRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createFlightByUser({ reservation_id: 9, user_id: 2 } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('computeFlightTime', () => {
    it('calculates correctly', () => {
      expect(service.computeFlightTime(100, 50)).toBe(2);
    });
    it('throws on zero speed', () => {
      expect(() => service.computeFlightTime(100, 0)).toThrow(
        'Cruise speed must be greater than 0',
      );
    });
  });

  describe('findOne', () => {
    it('returns flight if found', async () => {
      repo.findOne.mockResolvedValue({ id: 5 } as any);
      expect(await service.findOne(5)).toEqual({ id: 5 });
    });
    it('throws if missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(6)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateFlight', () => {
    it('updates and saves', async () => {
      repo.findOne.mockResolvedValue({ id: 7, waypoints: '[]' } as any);
      repo.save.mockResolvedValue({ id: 7 });
      const res = await service.updateFlight(7, {
        id: 7,
        origin_icao: 'XXX',
      } as any);
      expect(res).toEqual({ id: 7 });
    });
    it('throws if not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.updateFlight(8, { id: 8 } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeFlight', () => {
    it('returns true on delete', async () => {
      repo.delete.mockResolvedValue({ affected: 1 } as any);
      expect(await service.removeFlight(9)).toBe(true);
    });
  });

  describe('getDetailedWaypoints', () => {
    it('fetches info per waypoint', async () => {
      const wpJson = JSON.stringify([{ ident: 'I1' }]);
      (axios.get as jest.Mock).mockResolvedValue({
        data: { name: 'N', lat: 0, lon: 0 },
      });
      const res = await service.getDetailedWaypoints(wpJson);
      expect(res).toContain('I1: N, Lat: 0, Lon: 0');
    });
  });

  describe('getFlightsByUser & getRecentFlights', () => {
    it('delegates to repo.find', async () => {
      repo.find.mockResolvedValue([{ id: 1 }] as any);
      expect(await service.getFlightsByUser(1)).toEqual([{ id: 1 }]);
      expect(await service.getRecentFlights(2)).toEqual([{ id: 1 }]);
    });
  });
});
