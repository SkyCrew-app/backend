import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import { Cache } from 'cache-manager';
import { AirportsService } from '../airports.service';

describe('AirportsService', () => {
  let service: AirportsService;
  let cache: Partial<Cache>;
  let httpService: Partial<HttpService>;

  beforeEach(async () => {
    cache = { get: jest.fn(), set: jest.fn() };
    httpService = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AirportsService,
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: HttpService, useValue: httpService },
      ],
    }).compile();

    service = module.get<AirportsService>(AirportsService);
  });

  describe('getAirportInfo', () => {
    it('returns cached data when present', async () => {
      const data = { foo: 'bar' };
      (cache.get as jest.Mock).mockResolvedValue(data);
      const res = await service.getAirportInfo('LFPG');
      expect(res).toBe(data);
      expect(cache.get).toHaveBeenCalledWith('airport:LFPG');
    });

    it('fetches and caches data on cache miss', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      const fetched = { lat: 1, lon: 2 };
      jest.spyOn(service, 'fetchAirportInfo').mockResolvedValue(fetched);
      const res = await service.getAirportInfo('KJFK');
      expect(res).toMatchObject({
        lat: 1,
        lon: 2,
        lastUpdated: expect.any(Date),
      });
      expect(cache.set).toHaveBeenCalledWith(
        'airport:KJFK',
        expect.any(Object),
      );
    });

    it('throws on fetch failure', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      jest
        .spyOn(service, 'fetchAirportInfo')
        .mockRejectedValue(new Error('fail'));
      await expect(service.getAirportInfo('XXXX')).rejects.toThrow(
        'Impossible de récupérer les données pour XXXX',
      );
    });
  });

  describe('fetchAirportInfo', () => {
    it('returns data when valid coords', async () => {
      const mockGet = jest
        .spyOn(axios, 'get')
        .mockResolvedValue({ data: { lat: 3, lon: 4 } });
      const res = await service.fetchAirportInfo('EGLL');
      expect(res).toEqual({ lat: 3, lon: 4 });
      mockGet.mockRestore();
    });

    it('throws when coords missing', async () => {
      jest.spyOn(axios, 'get').mockResolvedValue({ data: {} });
      await expect(service.fetchAirportInfo('NONE')).rejects.toThrow(
        'Impossible de récupérer les données pour NONE',
      );
      (axios.get as jest.Mock).mockRestore();
    });
  });
});
