import {
  aerodromeConditions,
  decodeMetar,
  densityAltitudeFt,
  runwayEndsOf,
  runwayWinds,
} from '../aerodrome';
import {
  ACTIVITY_NEAR_NM,
  AirspaceRecord,
  legCrossings,
  unverifiedAirspaces,
} from '../airspace-intersection';
import { freezingLevelAt } from '../freezing';
import { direct, inverse, METRES_PER_NM } from '../geodesy';
import { legObstacles, ObstacleRecord } from '../obstacles';
import { pointLabel } from '../point-label';

// Runway wind, density altitude, obstacles, activity zones, freezing level
// and VFR point labels, with the real LFOP data of AIRAC 2610 where it
// matters.

describe('METAR decoding', () => {
  it('reads wind, gusts, temperature and QNH', () => {
    expect(
      decodeMetar(
        'LFOP 191030Z AUTO 22015G25KT 9999 BKN030 12/08 Q1009 TEMPO 25020G30KT',
      ),
    ).toEqual({
      windDirectionDeg: 220,
      windSpeedKt: 15,
      gustKt: 25,
      variable: false,
      temperatureC: 12,
      dewpointC: 8,
      qnhHpa: 1009,
      wet: false,
    });
  });

  it('reads a variable, a calm, a wind in m/s, negative temperatures and inches', () => {
    expect(
      decodeMetar('LFPN 191030Z VRB03KT CAVOK M02/M05 Q1030'),
    ).toMatchObject({
      windDirectionDeg: null,
      windSpeedKt: 3,
      variable: true,
      temperatureC: -2,
      dewpointC: -5,
    });
    expect(decodeMetar('LFPN 191030Z 00000KT CAVOK 10/05 Q1020')).toMatchObject(
      { windDirectionDeg: null, windSpeedKt: 0 },
    );
    expect(decodeMetar('UUEE 191030Z 24008MPS 9999 05/01 Q1000')).toMatchObject(
      { windDirectionDeg: 240, windSpeedKt: 16 },
    );
    expect(decodeMetar('KJFK 191051Z 31012KT 10SM 18/04 A2992')).toMatchObject({
      qnhHpa: 1013,
    });
    expect(decodeMetar(null).windSpeedKt).toBeNull();
  });
});

// LFOP, AIRAC 2610: runway 04/22 true 41.36 / 221.36 (AIXM Rdn).
const LFOP_RUNWAYS = [
  {
    designator: '04/22',
    trueHeadingDeg: 42,
    lengthM: 1700,
    widthM: 45,
    surface: 'enrobé bitumineux',
    ends: [
      { designator: '04', trueBearingDeg: 41.36, magneticBearingDeg: 39.92 },
      { designator: '22', trueBearingDeg: 221.36, magneticBearingDeg: 219.92 },
    ].map((end) => ({
      ...end,
      toraM: 1700,
      todaM: 1900,
      asdaM: 1700,
      ldaM: 1700,
      thresholdElevationFt: null,
      displacedThreshold: false,
      remarks: null,
    })),
  },
];

describe('runway wind', () => {
  it('splits the METAR wind into head and cross wind and suggests the runway', () => {
    const winds = runwayWinds(
      LFOP_RUNWAYS,
      decodeMetar('LFOP 191030Z 25015G25KT 12/08 Q1009'),
      1.44,
    );
    const r22 = winds.find((w) => w.designator === '22')!;
    const r04 = winds.find((w) => w.designator === '04')!;
    // 250 - 221.36 = 28.6°: head 15 cos = 13, cross 15 sin = 7 from the right.
    expect(r22).toMatchObject({
      headwindKt: 13,
      crosswindKt: 7,
      gustHeadwindKt: 22,
      gustCrosswindKt: 12,
      best: true,
    });
    expect(r04).toMatchObject({
      headwindKt: -13,
      crosswindKt: -7,
      best: false,
    });
  });

  it('suggests the main runway of two parallel ones (LFMT 30R, not 30L)', () => {
    const runway = (designator: string, main: boolean, lengthM: number) => ({
      designator,
      trueHeadingDeg: 124.69,
      lengthM,
      widthM: 45,
      surface: 'macadam',
      main,
    });
    const winds = runwayWinds(
      [runway('12R/30L', false, 1100), runway('12L/30R', true, 2600)],
      decodeMetar('LFMT 191230Z 32016KT 20/10 Q1019'),
      2.29,
    );
    expect(winds.find((w) => w.best)?.designator).toBe('30R');
  });

  it('gives no component for a variable or calm wind', () => {
    expect(
      runwayWinds(
        LFOP_RUNWAYS,
        decodeMetar('LFOP 191030Z VRB02KT 12/08 Q1009'),
        1.44,
      ),
    ).toEqual([]);
  });

  it('takes the runway number when no bearing is published (OurAirports)', () => {
    const ends = runwayEndsOf({
      designator: '09/27',
      trueHeadingDeg: null,
      lengthM: 800,
      widthM: 20,
      surface: null,
    });
    expect(ends.map((e) => e.designator)).toEqual(['09', '27']);
    const winds = runwayWinds(
      [
        {
          designator: '09/27',
          trueHeadingDeg: null,
          lengthM: 800,
          widthM: 20,
          surface: null,
        },
      ],
      decodeMetar('X 270/10 27010KT 10/05 Q1013'),
      0,
    );
    expect(winds.find((w) => w.best)?.designator).toBe('27');
  });
});

describe('density altitude', () => {
  it('equals the pressure altitude in the standard atmosphere', () => {
    expect(densityAltitudeFt(0, 15)).toBeCloseTo(0, 0);
    expect(densityAltitudeFt(5000, 15 - 9.9)).toBeCloseTo(5000, -1);
  });

  it('is about 120 ft higher per °C above standard (LFOP, 512 ft, 25 °C, QNH 1013)', () => {
    const conditions = aerodromeConditions(
      {
        icao: 'LFOP',
        elevationFt: 512,
        runways: LFOP_RUNWAYS,
        magneticVariationDeg: 1.44,
      },
      { metar: 'LFOP 191030Z 22010KT CAVOK 25/12 Q1013', observedAt: null },
    )!;
    // QNH 1013 is 0.25 hPa under the standard: 7 ft higher.
    expect(conditions.pressureAltitudeFt).toBe(519);
    // ISA at 519 ft is 14 °C: 11 °C warmer, about 1300 ft higher (the
    // rule of thumb's 120 ft per °C gives 1840 ft).
    expect(conditions.densityAltitudeFt).toBe(1797);
    expect(conditions.runways.find((r) => r.best)?.designator).toBe('22');
  });

  it('is unknown without a METAR', () => {
    expect(
      aerodromeConditions(
        {
          icao: 'LFOP',
          elevationFt: 512,
          runways: [],
          magneticVariationDeg: null,
        },
        null,
      ),
    ).toBeNull();
  });
});

describe('obstacles near a leg', () => {
  const from = { lat: 49, lon: 1.5 };
  const to = direct(from, 90, 20 * METRES_PER_NM);
  const at = (alongNm: number, offsetNm: number) => {
    const p = direct(from, 90, alongNm * METRES_PER_NM);
    return direct(p, 0, offsetNm * METRES_PER_NM);
  };
  const turbine = (
    ident: string,
    alongNm: number,
    offsetNm: number,
    amslFt: number,
  ): ObstacleRecord => ({
    ident,
    type: 'Eolienne(s)',
    ...at(alongNm, offsetNm),
    amslFt,
    aglFt: 500,
    count: 1,
    lighting: 'jour et nuit',
  });

  it('warns of the obstacles within 2 NM less than 500 ft below the leg altitude, a wind farm once', () => {
    const near = legObstacles(from, to, 20, 2500, [
      turbine('E1-1', 5, 1, 2150),
      turbine('E1-2', 5.3, 1.2, 2100),
      turbine('E1-3', 5.6, 0.8, 2120),
      turbine('E2-1', 12, 0.5, 1900), // 600 ft below: fine
      turbine('E3-1', 15, 3, 2400), // 3 NM aside: out of the corridor
      { ...turbine('P1', 18, -1.5, 2600), type: 'Pylône' }, // above the leg
    ]);
    expect(near.obstacles).toEqual([
      expect.objectContaining({
        ident: 'E1-1',
        count: 3,
        amslFt: 2150,
        marginFt: 350,
        alongNm: 5,
        offsetNm: 1,
        status: 'WARNING',
      }),
      expect.objectContaining({
        ident: 'P1',
        type: 'Pylône',
        count: 1,
        marginFt: -100,
      }),
    ]);
    expect(near.highestFt).toBe(2600);
  });

  it('says nothing when all are well below', () => {
    expect(
      legObstacles(from, to, 20, 3500, [turbine('E', 5, 0.2, 1500)]),
    ).toEqual({ obstacles: [], highestFt: 1500 });
  });
});

describe('activities published at a point', () => {
  const from = { lat: 49, lon: 1.5 };
  const to = direct(from, 90, 20 * METRES_PER_NM);
  const zone = (
    type: AirspaceRecord['type'],
    offsetNm: number,
    ceiling: AirspaceRecord['ceiling'],
  ): AirspaceRecord => {
    const p = direct(
      direct(from, 90, 10 * METRES_PER_NM),
      0,
      offsetNm * METRES_PER_NM,
    );
    return {
      id: type,
      name: `${type} test`,
      type,
      icaoClass: null,
      floor: { ref: 'SFC', value: 0 },
      ceiling,
      activity: null,
      hours: 'SR-SS',
      scheduleCode: 'HJ',
      frequencies: [],
      remarks: null,
      geometry: [],
      minLat: p.lat,
      maxLat: p.lat,
      minLon: p.lon,
      maxLon: p.lon,
    };
  };
  const cross = (airspaces: AirspaceRecord[], altitude = 2500) =>
    legCrossings(
      { from, to, distanceNm: 20, altitudeAt: () => altitude },
      airspaces,
      1013.25,
      300,
    );

  it('lists a parachuting zone 2 NM from the leg as a warning, over the stretch within 3 NM', () => {
    const [crossing] = cross([
      zone('PARACHUTING', 2, { ref: 'FL', value: 145 }),
    ]);
    expect(ACTIVITY_NEAR_NM.PARACHUTING).toBe(3);
    expect(crossing.status).toBe('WARNING');
    expect(crossing.relation).toBe('INSIDE');
    // sqrt(3² - 2²) = 2.24 NM either side of the nearest point.
    expect(crossing.entryNm).toBeCloseTo(10 - Math.sqrt(5), 1);
    expect(crossing.exitNm).toBeCloseTo(10 + Math.sqrt(5), 1);
    expect(crossing.requirement.key).toBe('navplan.airspace.parachuting');
    expect(crossing.requirement.params).toMatchObject({
      limit: 'FL145',
      activity: 'SR-SS',
    });
  });

  it('ignores one further than its distance, and model aircraft flown under the route', () => {
    expect(cross([zone('PARACHUTING', 4, { ref: 'FL', value: 145 })])).toEqual(
      [],
    );
    expect(
      cross([zone('MODEL_AIRCRAFT', 0.5, { ref: 'AMSL', value: 1500 })]),
    ).toEqual([]);
    expect(
      cross(
        [zone('MODEL_AIRCRAFT', 0.5, { ref: 'AMSL', value: 1500 })],
        1200,
      )[0].status,
    ).toBe('WARNING');
  });

  it('lists model aircraft whose limit is above the ground as a lookout only', () => {
    const [crossing] = cross([
      zone('MODEL_AIRCRAFT', 0.5, { ref: 'AGL', value: 80 }),
    ]);
    expect(crossing.relation).toBe('UNKNOWN_VERTICAL');
    expect(crossing.status).toBe('OK');
  });

  it('asks to check the height over a low-level overflight ban given above the ground', () => {
    const [crossing] = cross([
      zone('LOW_OVERFLIGHT', 1, { ref: 'AGL', value: 1000 }),
    ]);
    expect(crossing.relation).toBe('UNKNOWN_VERTICAL');
    expect(crossing.status).toBe('WARNING');
    expect(crossing.requirement.key).toBe('navplan.airspace.lowOverflight');
  });

  it('never lists them as areas of unknown outline', () => {
    expect(
      unverifiedAirspaces(
        [{ from, to }],
        [zone('DRONE', 0, { ref: 'AGL', value: 490 })],
        null,
        1013.25,
        300,
      ),
    ).toEqual([]);
  });
});

describe('freezing level', () => {
  // 15 °C at the ground, -2 °C per 1000 ft: 0 °C at 7500 ft.
  const lapse = (altitude: number) => 15 - (2 * altitude) / 1000;

  it('finds the 0 °C isotherm', () => {
    expect(freezingLevelAt(lapse, 500)).toEqual({
      altitudeFt: 7500,
      state: 'LEVEL',
      topFt: null,
    });
  });

  it('says at the surface, above the forecast, or unknown', () => {
    expect(freezingLevelAt((a) => -3 - a / 1000, 1000)).toMatchObject({
      state: 'SURFACE',
      altitudeFt: 1000,
    });
    expect(freezingLevelAt((a) => (a > 13800 ? null : 20), 0)).toEqual({
      altitudeFt: null,
      state: 'ABOVE',
      topFt: 13800,
    });
    expect(freezingLevelAt(() => null, 0).state).toBe('UNKNOWN');
  });
});

describe('VFR reporting point labels', () => {
  it('writes the aerodrome before a reporting point', () => {
    expect(pointLabel({ type: 'VRP', ident: 'S', aerodromeIcao: 'LFPN' })).toBe(
      'LFPN S',
    );
    expect(
      pointLabel({ type: 'VOR_DME', ident: 'RBT', aerodromeIcao: null }),
    ).toBe('RBT');
    expect(pointLabel({ type: 'VRP', ident: 'NW', aerodromeIcao: null })).toBe(
      'NW',
    );
  });

  it('keeps the geometry helpers consistent', () => {
    expect(
      inverse(
        { lat: 49, lon: 1.5 },
        direct({ lat: 49, lon: 1.5 }, 90, 20 * METRES_PER_NM),
      ).distanceNm,
    ).toBeCloseTo(20, 3);
  });
});
