import { decodeMetar, RunwayData } from '../aerodrome';
import { computeFlightPlan } from '../engine';
import {
  aerodromeDistances,
  DistanceConditions,
  interpolateDistances,
  requiredDistances,
  RunwayDistanceTable,
  runwaySlopePercent,
  runwaySurfaceKind,
} from '../runway-distances';
import { engineInput } from './fixture';

// A made-up table for the arithmetic only (no aircraft's figures).
const TABLE: RunwayDistanceTable = {
  rows: [
    { pressureAltFt: 0, temperatureC: 0, groundRollM: 200, distance15mM: 400 },
    { pressureAltFt: 0, temperatureC: 20, groundRollM: 240, distance15mM: 480 },
    {
      pressureAltFt: 4000,
      temperatureC: 0,
      groundRollM: 300,
      distance15mM: 600,
    },
    {
      pressureAltFt: 4000,
      temperatureC: 20,
      groundRollM: 360,
      distance15mM: 720,
    },
  ],
  referenceMassKg: 1000,
  source: 'test',
};

const DRY_PAVED: DistanceConditions = {
  pressureAltFt: 0,
  temperatureC: 0,
  massKg: 1000,
  headwindKt: 0,
  surface: 'PAVED',
  wet: false,
  slopePercent: 0,
};

const factorOf = (result: ReturnType<typeof requiredDistances>, code: string) =>
  result.factors.find((f) => f.code === code);

describe('distance table interpolation', () => {
  it('gives the table at its points and interpolates between them', () => {
    expect(interpolateDistances(TABLE, 0, 0, 1000)).toEqual({
      groundRollM: 200,
      distance15mM: 400,
      outOfTable: false,
    });
    expect(interpolateDistances(TABLE, 2000, 10, 1000)).toEqual({
      groundRollM: 275,
      distance15mM: 550,
      outOfTable: false,
    });
  });

  it('never extrapolates: hotter or higher is outside the table, at its edge', () => {
    expect(interpolateDistances(TABLE, 6000, 35, 1000)).toEqual({
      groundRollM: 360,
      distance15mM: 720,
      outOfTable: true,
    });
  });

  it('keeps the edge value, larger than the real one, below the table', () => {
    expect(interpolateDistances(TABLE, -500, -10, 900)).toEqual({
      groundRollM: 200,
      distance15mM: 400,
      outOfTable: false,
    });
  });

  it('is outside the table above its reference mass', () => {
    expect(interpolateDistances(TABLE, 0, 0, 1100)?.outOfTable).toBe(true);
  });

  it('interpolates between masses when the table gives several', () => {
    const table: RunwayDistanceTable = {
      referenceMassKg: null,
      rows: [
        ...TABLE.rows.map((r) => ({ ...r, massKg: 1000 })),
        ...TABLE.rows.map((r) => ({
          ...r,
          massKg: 800,
          groundRollM: r.groundRollM / 2,
          distance15mM: r.distance15mM / 2,
        })),
      ],
    };
    expect(interpolateDistances(table, 0, 0, 900)).toMatchObject({
      groundRollM: 150,
      distance15mM: 300,
      outOfTable: false,
    });
    expect(interpolateDistances(table, 0, 0, 1200)?.outOfTable).toBe(true);
  });

  it('works on a table whose altitudes do not share temperatures', () => {
    const table: RunwayDistanceTable = {
      referenceMassKg: null,
      rows: [
        {
          pressureAltFt: 0,
          temperatureC: 0,
          groundRollM: 100,
          distance15mM: 200,
        },
        {
          pressureAltFt: 0,
          temperatureC: 30,
          groundRollM: 130,
          distance15mM: 260,
        },
        {
          pressureAltFt: 2000,
          temperatureC: 10,
          groundRollM: 150,
          distance15mM: 300,
        },
        {
          pressureAltFt: 2000,
          temperatureC: 20,
          groundRollM: 170,
          distance15mM: 340,
        },
      ],
    };
    // At 1000 ft, 15 °C: (115 + 160) / 2.
    expect(
      interpolateDistances(table, 1000, 15, null)?.groundRollM,
    ).toBeCloseTo(137.5);
  });
});

describe('take-off and landing corrections', () => {
  it('applies the club factor alone on a dry paved level runway in calm wind', () => {
    const result = requiredDistances('TAKEOFF', TABLE, DRY_PAVED, 1.33);
    expect(result.factors).toEqual([
      { code: 'safety', factor: 1.33, source: 'CLUB' },
    ]);
    expect(result.requiredGroundRollM).toBe(266);
    expect(result.requiredDistance15mM).toBe(532);
    expect(result.status).toBe('OK');
  });

  it('uses the UK CAA generic factors when the manual gives none', () => {
    const takeoff = requiredDistances(
      'TAKEOFF',
      TABLE,
      { ...DRY_PAVED, surface: 'GRASS', slopePercent: 2 },
      1.33,
    );
    expect(factorOf(takeoff, 'grass')).toEqual({
      code: 'grass',
      factor: 1.2,
      source: 'CAA_SSL7',
    });
    expect(factorOf(takeoff, 'slope')).toMatchObject({
      factor: 1.1,
      source: 'CAA_SSL7',
    });
    expect(takeoff.requiredDistance15mM).toBe(
      Math.ceil(400 * 1.2 * 1.1 * 1.33),
    );

    const landing = requiredDistances(
      'LANDING',
      TABLE,
      { ...DRY_PAVED, surface: 'GRASS', wet: true, slopePercent: -2 },
      1.43,
    );
    expect(factorOf(landing, 'wetGrass')).toMatchObject({
      factor: 1.35,
      source: 'CAA_SSL7',
    });
    expect(factorOf(landing, 'slope')).toMatchObject({ factor: 1.1 });
    expect(landing.requiredDistance15mM).toBe(
      Math.ceil(400 * 1.35 * 1.1 * 1.43),
    );
    // Up hill on landing, down hill on take-off: no credit.
    expect(
      factorOf(
        requiredDistances(
          'LANDING',
          TABLE,
          { ...DRY_PAVED, slopePercent: 2 },
          1,
        ),
        'slope',
      ),
    ).toBeUndefined();
    expect(
      factorOf(
        requiredDistances(
          'TAKEOFF',
          TABLE,
          { ...DRY_PAVED, slopePercent: -2 },
          1,
        ),
        'slope',
      ),
    ).toBeUndefined();
  });

  it('applies the manual corrections when entered', () => {
    const manual: RunwayDistanceTable = {
      ...TABLE,
      grassPercent: 15,
      wetGrassPercent: 25,
      slopePercentPerPercent: 7,
    };
    const result = requiredDistances(
      'TAKEOFF',
      manual,
      { ...DRY_PAVED, surface: 'GRASS', wet: true, slopePercent: 1 },
      1,
    );
    expect(factorOf(result, 'wetGrass')).toEqual({
      code: 'wetGrass',
      factor: 1.25,
      source: 'MANUAL',
    });
    expect(factorOf(result, 'slope')).toMatchObject({
      factor: 1.07,
      source: 'MANUAL',
    });
  });

  it('credits half the head wind and applies 150 % of the tail wind', () => {
    const manual: RunwayDistanceTable = {
      ...TABLE,
      headwindPercentPerKt: 1,
      tailwindPercentPerKt: 5,
    };
    expect(
      factorOf(
        requiredDistances(
          'TAKEOFF',
          manual,
          { ...DRY_PAVED, headwindKt: 10 },
          1,
        ),
        'headwind',
      ),
    ).toMatchObject({ factor: 0.95, source: 'MANUAL' });
    expect(
      factorOf(
        requiredDistances(
          'TAKEOFF',
          manual,
          { ...DRY_PAVED, headwindKt: -4 },
          1,
        ),
        'tailwind',
      ),
    ).toMatchObject({ factor: 1.3, source: 'MANUAL' });
  });

  it('credits no head wind without the manual, and scales the CAA tail wind factor', () => {
    expect(
      requiredDistances('TAKEOFF', TABLE, { ...DRY_PAVED, headwindKt: 15 }, 1)
        .requiredDistance15mM,
    ).toBe(400);
    const tail = requiredDistances(
      'LANDING',
      { ...TABLE, speedKt: 60 },
      { ...DRY_PAVED, headwindKt: -6 },
      1,
    );
    // A tail wind of 10 % of the speed: +20 %.
    expect(factorOf(tail, 'tailwind')).toMatchObject({
      factor: 1.2,
      source: 'CAA_SSL7',
    });
    const unknown = requiredDistances(
      'LANDING',
      TABLE,
      { ...DRY_PAVED, headwindKt: -6 },
      1,
    );
    expect(unknown.status).toBe('WARNING');
    expect(unknown.messages).toContainEqual({
      key: 'navplan.distance.tailwindNotCorrected',
      params: { tailwind: 6 },
    });
  });

  it('warns outside the table, and without a table is never OK', () => {
    expect(
      requiredDistances('TAKEOFF', TABLE, { ...DRY_PAVED, temperatureC: 40 }, 1)
        .status,
    ).toBe('WARNING');
    const missing = requiredDistances('TAKEOFF', null, DRY_PAVED, 1.33);
    expect(missing).toMatchObject({
      requiredDistance15mM: null,
      status: 'WARNING',
      messages: [{ key: 'navplan.distance.noTable' }],
    });
  });
});

describe('runway surface, slope and wet runway', () => {
  it.each([
    ['revêtue', 'PAVED'],
    ['béton bitumineux', 'PAVED'],
    ['ASP', 'PAVED'],
    ['CON', 'PAVED'],
    ['Asphalt', 'PAVED'],
    ['non revêtue', 'UNPAVED'],
    ['gazon', 'GRASS'],
    ['GRS', 'GRASS'],
    ['Turf', 'GRASS'],
    ['grass/asphalt', 'GRASS'],
    ['CONC+GRS', 'GRASS'],
    ['Compacted Earth', 'UNPAVED'],
    ['UNK', 'UNKNOWN'],
    [null, 'UNKNOWN'],
  ])('reads "%s" as %s', (surface, kind) => {
    expect(runwaySurfaceKind(surface)).toBe(kind);
  });

  it('works the slope out from the threshold elevations', () => {
    const runway: RunwayData = {
      designator: '07/25',
      trueHeadingDeg: 70,
      lengthM: 1000,
      widthM: 30,
      surface: 'gazon',
      ends: ['07', '25'].map((designator, i) => ({
        designator,
        trueBearingDeg: 70 + i * 180,
        magneticBearingDeg: null,
        toraM: 1000,
        todaM: 1000,
        asdaM: 1000,
        ldaM: 1000,
        thresholdElevationFt: i === 0 ? 300 : 365.6,
        displacedThreshold: false,
        remarks: null,
      })),
    };
    expect(runwaySlopePercent(runway, '07')).toBe(2);
    expect(runwaySlopePercent(runway, '25')).toBe(-2);
  });

  it('takes the runway as wet with rain, drizzle or snow, present or recent', () => {
    expect(
      decodeMetar('LFRS 201030Z 22010KT 9999 -RA BKN010 12/10 Q1009').wet,
    ).toBe(true);
    expect(
      decodeMetar('LFRS 201030Z 22010KT 9999 RERA BKN010 12/10 Q1009').wet,
    ).toBe(true);
    expect(
      decodeMetar('LFRS 201030Z 22010KT 9999 +SHRA BKN010 12/10 Q1009').wet,
    ).toBe(true);
    expect(
      decodeMetar('LFRS 201030Z 22010KT 9999 VCSH BKN010 12/10 Q1009').wet,
    ).toBe(false);
    expect(
      decodeMetar('LFRS 201030Z 22010KT CAVOK 12/10 Q1009 TEMPO RA').wet,
    ).toBe(false);
  });
});

describe('runway distances against the declared distances', () => {
  const runway = (toraM: number, ldaM: number): RunwayData => ({
    designator: '09/27',
    trueHeadingDeg: 90,
    lengthM: toraM,
    widthM: 20,
    surface: 'revêtue',
    main: true,
    ends: ['09', '27'].map((designator, i) => ({
      designator,
      trueBearingDeg: 90 + i * 180,
      magneticBearingDeg: null,
      toraM,
      todaM: toraM,
      asdaM: toraM,
      ldaM,
      thresholdElevationFt: 100,
      displacedThreshold: false,
      remarks: null,
    })),
  });
  const check = (toraM: number, ldaM: number, kind: 'TAKEOFF' | 'LANDING') =>
    aerodromeDistances({
      kind,
      runways: [runway(toraM, ldaM)],
      elevationFt: 100,
      pressureAltitudeOf: () => 0,
      temperatureC: 0,
      conditionsSource: 'METAR',
      massKg: 1000,
      massSource: 'MASS_BALANCE',
      winds: [
        {
          designator: '09',
          headwindKt: 5,
          crosswindKt: 0,
          gustHeadwindKt: null,
          gustCrosswindKt: null,
          best: true,
        },
        {
          designator: '27',
          headwindKt: -5,
          crosswindKt: 0,
          gustHeadwindKt: null,
          gustCrosswindKt: null,
          best: false,
        },
      ],
      wet: false,
      table: { ...TABLE, speedKt: 50 },
      safetyFactor: 1.33,
    });

  it('is BLOCKING beyond the available distance, WARNING within 10 %', () => {
    // Take-off: 532 m to 15 m (400 x 1.33) on runway 09.
    expect(check(800, 800, 'TAKEOFF').status).toBe('OK');
    expect(check(560, 560, 'TAKEOFF').status).toBe('WARNING');
    const blocked = check(500, 500, 'TAKEOFF');
    expect(blocked.status).toBe('BLOCKING');
    const suggested = blocked.runways.find((r) => r.suggested)!;
    expect(suggested).toMatchObject({
      designator: '09',
      requiredDistance15mM: 532,
      availableDistanceM: 500,
      marginM: -32,
    });
    // Every direction is listed, the tail wind one with its factor.
    expect(blocked.runways.map((r) => r.designator)).toEqual(['09', '27']);
    expect(
      blocked.runways[1].factors.find((f) => f.code === 'tailwind'),
    ).toBeDefined();
  });

  it('takes a calm wind as no wind, a variable one as a tail wind', () => {
    const withWind = (uniformHeadwindKt: number) =>
      aerodromeDistances({
        kind: 'LANDING',
        runways: [runway(1000, 1000)],
        elevationFt: 100,
        pressureAltitudeOf: () => 0,
        temperatureC: 0,
        conditionsSource: 'METAR',
        massKg: 1000,
        massSource: 'MASS_BALANCE',
        winds: [],
        uniformHeadwindKt,
        wet: false,
        table: { ...TABLE, speedKt: 60 },
        safetyFactor: 1.43,
      }).runways[0];
    const calm = withWind(0);
    expect(calm.headwindKt).toBe(0);
    expect(calm.messages).not.toContainEqual({
      key: 'navplan.distance.windUnknown',
    });
    expect(
      withWind(-6).factors.find((f) => f.code === 'tailwind'),
    ).toMatchObject({ factor: 1.2 });
  });

  it('compares the landing with the LDA', () => {
    const landing = check(1000, 500, 'LANDING');
    expect(landing.runways[0]).toMatchObject({
      availableRunM: null,
      availableDistanceM: 500,
      status: 'BLOCKING',
    });
  });
});

describe('distances in the plan', () => {
  it('asks for the manual tables when the aircraft has none', () => {
    const result = computeFlightPlan(engineInput());
    expect(
      result.notices.find((n) => n.code === 'DISTANCE_DATA_MISSING'),
    ).toMatchObject({ status: 'WARNING' });
    const departure = result.aerodromes!.find((a) => a.role === 'departure')!;
    expect(departure.distances).toMatchObject({
      kind: 'TAKEOFF',
      dataMissing: true,
      conditionsSource: 'ISA',
    });
  });
});
