import axios from 'axios';
import { Logger } from '@nestjs/common';
import { AviationDataService } from '../aviation-data.service';

jest.mock('axios');

const get = axios.get as jest.Mock;

const LFPG = {
  icao: 'LFPG',
  iata: 'CDG',
  name: 'Charles de Gaulle International Airport',
  city: 'Paris',
  region: 'Ile-de-France',
  country: 'FR',
  elevation_ft: '392',
  latitude: '49.0127983093',
  longitude: '2.5499999523',
  timezone: 'Europe/Paris',
};

describe('AviationDataService', () => {
  let service: AviationDataService;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.API_NINJAS_KEY = 'test-key';
    service = new AviationDataService();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.API_NINJAS_KEY;
    jest.restoreAllMocks();
  });

  describe('without API_NINJAS_KEY', () => {
    beforeEach(() => {
      delete process.env.API_NINJAS_KEY;
    });

    it('answers nothing, calls nobody and warns once', async () => {
      await expect(service.aerodromeByIcao('LFPG')).resolves.toBeNull();
      await expect(service.aerodromeByIata('CDG')).resolves.toBeNull();
      await expect(service.searchAerodromes('paris')).resolves.toEqual([]);
      await expect(service.weatherAt(49, 2.5)).resolves.toBeNull();

      expect(get).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('API_NINJAS_KEY');
    });
  });

  describe('aerodromeByIcao', () => {
    it('asks the provider with the key in a header and maps the answer', async () => {
      get.mockResolvedValue({ data: [LFPG] });

      await expect(service.aerodromeByIcao(' lfpg ')).resolves.toEqual({
        icao: 'LFPG',
        iata: 'CDG',
        name: 'Charles de Gaulle International Airport',
        city: 'Paris',
        country: 'FR',
        latitude: 49.0127983093,
        longitude: 2.5499999523,
      });

      expect(get).toHaveBeenCalledWith(
        'https://api.api-ninjas.com/v1/airports',
        expect.objectContaining({
          params: { icao: 'LFPG' },
          headers: { 'X-Api-Key': 'test-key' },
          timeout: 5000,
        }),
      );
    });

    it('answers null when nothing is found', async () => {
      get.mockResolvedValue({ data: [] });

      await expect(service.aerodromeByIcao('ZZZZ')).resolves.toBeNull();
    });

    it.each(['LFP', 'LFPGX', 'LF1G', 'LFPG&name=x', ''])(
      'does not call the provider for "%s"',
      async (icao) => {
        await expect(service.aerodromeByIcao(icao)).resolves.toBeNull();
        expect(get).not.toHaveBeenCalled();
      },
    );

    it('answers from memory the second time', async () => {
      get.mockResolvedValue({ data: [LFPG] });

      await service.aerodromeByIcao('LFPG');
      await service.aerodromeByIcao('lfpg');

      expect(get).toHaveBeenCalledTimes(1);
    });

    it('asks again once the answer is a day old', async () => {
      get.mockResolvedValue({ data: [LFPG] });
      const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

      await service.aerodromeByIcao('LFPG');
      now.mockReturnValue(1_000_000 + 24 * 60 * 60 * 1000 + 1);
      await service.aerodromeByIcao('LFPG');

      expect(get).toHaveBeenCalledTimes(2);
    });

    it('answers null and remembers nothing when the provider fails', async () => {
      get.mockRejectedValueOnce(new Error('Request failed with status 429'));
      get.mockResolvedValueOnce({ data: [LFPG] });

      await expect(service.aerodromeByIcao('LFPG')).resolves.toBeNull();
      await expect(service.aerodromeByIcao('LFPG')).resolves.toMatchObject({
        icao: 'LFPG',
      });

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).not.toContain('test-key');
    });

    it('ignores an answer that is not a list of aerodromes', async () => {
      get.mockResolvedValue({ data: { error: 'quota' } });
      await expect(service.aerodromeByIcao('LFPG')).resolves.toBeNull();

      get.mockResolvedValue({ data: [null, { icao: 'LFXX' }, 'x'] });
      await expect(service.aerodromeByIcao('LFXX')).resolves.toBeNull();
    });
  });

  describe('aerodromeByIata', () => {
    it('looks the code up', async () => {
      get.mockResolvedValue({ data: [LFPG] });

      await expect(service.aerodromeByIata('cdg')).resolves.toMatchObject({
        iata: 'CDG',
      });
      expect(get.mock.calls[0][1].params).toEqual({ iata: 'CDG' });
    });

    it.each(['CD', 'CDGX', 'C1G'])(
      'does not call the provider for "%s"',
      async (iata) => {
        await expect(service.aerodromeByIata(iata)).resolves.toBeNull();
        expect(get).not.toHaveBeenCalled();
      },
    );
  });

  describe('searchAerodromes', () => {
    const byParams = (answers: Record<string, unknown[]>) =>
      get.mockImplementation(async (_url, { params }) => ({
        data: answers[Object.keys(params)[0]] ?? [],
      }));

    it('searches a free text by name', async () => {
      byParams({ name: [LFPG] });

      await expect(service.searchAerodromes('De Gaulle')).resolves.toHaveLength(
        1,
      );
      expect(get).toHaveBeenCalledTimes(1);
      expect(get.mock.calls[0][1].params).toEqual({ name: 'de gaulle' });
    });

    it('tries four letters as an ICAO code first, without duplicates', async () => {
      const other = { ...LFPG, icao: 'LFPO', iata: 'ORY', name: 'Orly' };
      byParams({ icao: [LFPG], name: [LFPG, other] });

      const found = await service.searchAerodromes('lfpg');

      expect(found.map((aerodrome) => aerodrome.icao)).toEqual([
        'LFPG',
        'LFPO',
      ]);
      expect(get.mock.calls.map(([, { params }]) => params)).toEqual([
        { icao: 'LFPG' },
        { name: 'lfpg' },
      ]);
    });

    it('tries three letters as an IATA code first', async () => {
      byParams({ iata: [LFPG] });

      await expect(service.searchAerodromes('CDG')).resolves.toHaveLength(1);
      expect(get.mock.calls[0][1].params).toEqual({ iata: 'CDG' });
    });

    it('returns at most 20 aerodromes', async () => {
      byParams({
        name: Array.from({ length: 30 }, (_, index) => ({
          name: `Terrain ${index}`,
        })),
      });

      await expect(service.searchAerodromes('terrain')).resolves.toHaveLength(
        20,
      );
    });

    it.each(['a', ' a ', 'x'.repeat(51)])(
      'does not call the provider for a query of the wrong length',
      async (query) => {
        await expect(service.searchAerodromes(query)).resolves.toEqual([]);
        expect(get).not.toHaveBeenCalled();
      },
    );
  });

  describe('weatherAt', () => {
    const WEATHER = {
      cloud_pct: 40,
      temp: 12,
      feels_like: 10,
      humidity: 71,
      min_temp: 9,
      max_temp: 14,
      wind_speed: 5.4,
      wind_degrees: 250,
      sunrise: 1791871200,
      sunset: 1791910800,
    };

    it('maps the conditions at the coordinates', async () => {
      get.mockResolvedValue({ data: WEATHER });

      await expect(service.weatherAt(49.0127983, 2.5499999)).resolves.toEqual({
        temperature: 12,
        feelsLike: 10,
        humidity: 71,
        cloudCover: 40,
        windSpeed: 5.4,
        windDegrees: 250,
        sunrise: 1791871200,
        sunset: 1791910800,
      });
      expect(get).toHaveBeenCalledWith(
        'https://api.api-ninjas.com/v1/weather',
        expect.objectContaining({ params: { lat: '49.01', lon: '2.55' } }),
      );
    });

    it('shares one answer between close positions for ten minutes', async () => {
      get.mockResolvedValue({ data: WEATHER });
      const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

      await service.weatherAt(49.0127, 2.5499);
      await service.weatherAt(49.0131, 2.5512);
      expect(get).toHaveBeenCalledTimes(1);

      now.mockReturnValue(1_000_000 + 10 * 60 * 1000 + 1);
      await service.weatherAt(49.0127, 2.5499);
      expect(get).toHaveBeenCalledTimes(2);
    });

    it.each([
      [91, 0],
      [-90.5, 0],
      [0, 181],
      [0, -180.1],
      [NaN, 0],
      [0, Infinity],
    ])('does not call the provider for %p, %p', async (latitude, longitude) => {
      await expect(service.weatherAt(latitude, longitude)).resolves.toBeNull();
      expect(get).not.toHaveBeenCalled();
    });

    it('answers null when the provider fails or answers something else', async () => {
      get.mockRejectedValueOnce(new Error('timeout of 5000ms exceeded'));
      await expect(service.weatherAt(1, 1)).resolves.toBeNull();

      get.mockResolvedValueOnce({ data: [] });
      await expect(service.weatherAt(2, 2)).resolves.toBeNull();
    });
  });

  it('keeps at most 500 answers in memory', async () => {
    get.mockResolvedValue({ data: {} });

    for (let index = 0; index < 501; index++) {
      await service.weatherAt(index / 100, 0);
    }
    expect(get).toHaveBeenCalledTimes(501);

    // The oldest answer made room for the last one; the second is still there.
    await service.weatherAt(0.01, 0);
    expect(get).toHaveBeenCalledTimes(501);
    await service.weatherAt(0, 0);
    expect(get).toHaveBeenCalledTimes(502);
  });
});
