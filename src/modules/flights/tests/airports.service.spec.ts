import { Test, TestingModule } from '@nestjs/testing';
import { AirportsService } from '../airports.service';

describe('AirportsService', () => {
  let service: AirportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AirportsService],
    }).compile();

    service = module.get<AirportsService>(AirportsService);
    service.onModuleInit();
  });

  describe('getAirportInfo', () => {
    it('returns airport data from map', () => {
      const res = service.getAirportInfo('KJFK');
      expect(res).toMatchObject({
        icao: 'KJFK',
        lat: expect.any(Number),
        lon: expect.any(Number),
      });
    });

    it('is case-insensitive', () => {
      const res = service.getAirportInfo('kjfk');
      expect(res.icao).toBe('KJFK');
    });

    it('throws if unknown airport', () => {
      expect(() => service.getAirportInfo('XXXX')).toThrow(
        'Aéroport introuvable pour le code XXXX',
      );
    });
  });

  describe('fetchAirportInfo', () => {
    it('returns local airport data', () => {
      const res = service.fetchAirportInfo('EGLL');
      expect(res).toMatchObject({ icao: 'EGLL' });
    });

    it('contains requested French aerodromes', () => {
      expect(service.fetchAirportInfo('LFPB').name).toContain('Le Bourget');
      expect(service.fetchAirportInfo('LFCL').name).toContain('Lasbordes');
    });
  });
});
