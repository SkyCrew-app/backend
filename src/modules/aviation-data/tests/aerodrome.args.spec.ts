import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AerodromeByIataArgs,
  AerodromeByIcaoArgs,
  SearchAerodromesArgs,
  WeatherAtArgs,
} from '../dto/aerodrome.args';

// The same steps as the global validation pipe: transform, then validate.
const errorsOf = async (type: any, value: object) =>
  (await validate(plainToInstance(type, value) as object)).length;

describe('aviation data arguments', () => {
  it.each(['LFPG', 'lfpg', ' LFPG '])(
    'accepts the ICAO code "%s"',
    async (icao) => {
      expect(await errorsOf(AerodromeByIcaoArgs, { icao })).toBe(0);
    },
  );

  it.each(['LFP', 'LFPGA', 'LF1G', 'LF G', 'LFPG&x=1', '', 42])(
    'refuses the ICAO code %p',
    async (icao) => {
      expect(await errorsOf(AerodromeByIcaoArgs, { icao })).toBeGreaterThan(0);
    },
  );

  it('accepts three letters as an IATA code and nothing else', async () => {
    expect(await errorsOf(AerodromeByIataArgs, { iata: 'CDG' })).toBe(0);
    expect(await errorsOf(AerodromeByIataArgs, { iata: 'CDGX' })).toBe(1);
    expect(await errorsOf(AerodromeByIataArgs, { iata: 'C1' })).toBe(1);
  });

  it.each(['LF', 'Saint-Cyr-l’École', "L'Aigle", 'Nîmes Garons', 'LFPG'])(
    'accepts the search "%s"',
    async (query) => {
      expect(await errorsOf(SearchAerodromesArgs, { query })).toBe(0);
    },
  );

  it.each([
    'a',
    ' a ',
    'x'.repeat(51),
    'paris&icao=LFPG',
    'a/b',
    '<b>',
    'a\nb',
  ])('refuses the search %p', async (query) => {
    expect(await errorsOf(SearchAerodromesArgs, { query })).toBeGreaterThan(0);
  });

  it.each([
    [49.01, 2.55],
    [-90, 180],
    [90, -180],
    [0, 0],
  ])('accepts the position %p, %p', async (latitude, longitude) => {
    expect(await errorsOf(WeatherAtArgs, { latitude, longitude })).toBe(0);
  });

  it.each([
    [90.1, 0],
    [-91, 0],
    [0, 180.5],
    [0, -181],
    [NaN, 0],
    [0, Infinity],
    ['49', 2],
  ])('refuses the position %p, %p', async (latitude, longitude) => {
    expect(
      await errorsOf(WeatherAtArgs, { latitude, longitude }),
    ).toBeGreaterThan(0);
  });
});
