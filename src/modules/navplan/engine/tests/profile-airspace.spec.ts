import { buildProfile, ProfileLeg } from '../vertical-profile';
import { densityRatio, isaTemperatureC } from '../atmosphere';
import { PerformanceData } from '../types';
import {
  AirspaceRecord,
  lateralIntervals,
  legCrossings,
  referencePointOf,
  UNLOCATED_BOX,
  UNVERIFIED_AIRSPACE_NEAR_NM,
  unverifiedAirspaces,
} from '../airspace-intersection';
import { computeFlightPlan } from '../engine';
import { renderResult } from '../../render';
import { engineInput, LFRN, LFRS } from './fixture';
import { direct, inverse, METRES_PER_NM } from '../geodesy';
import { cruiseAt, PerformanceError } from '../performance';

const performance = (descentIas = 100): PerformanceData => ({
  fuel: {
    type: 'AVGAS_100LL',
    densityKgPerL: 0.72,
    tanks: [
      { id: 'main', label: 'Main', usableL: 110, unusableL: 1, armM: 1.12 },
    ],
    taxiFuelL: 3,
    burnOrder: [],
  },
  climb: {
    iasKt: 75,
    table: [
      { pressureAltFt: 0, timeMin: 0, fuelL: 0, distanceNm: 0 },
      { pressureAltFt: 2000, timeMin: 3, fuelL: 1.9, distanceNm: 4 },
      { pressureAltFt: 4000, timeMin: 6.5, fuelL: 3.9, distanceNm: 8 },
      { pressureAltFt: 6000, timeMin: 10.5, fuelL: 6.2, distanceNm: 13 },
    ],
  },
  cruise: {
    normalSetting: '2400',
    rows: [
      {
        pressureAltFt: 0,
        setting: '2400',
        isaDeviationC: 0,
        tasKt: 110,
        fuelFlowLph: 28,
      },
      {
        pressureAltFt: 10000,
        setting: '2400',
        isaDeviationC: 0,
        tasKt: 110,
        fuelFlowLph: 28,
      },
    ],
  },
  descent: { iasKt: descentIas, rateFpm: 500, fuelFlowLph: 20 },
  reserve: { holdingFuelFlowLph: 24, maxContinuousFuelFlowLph: 34 },
  arrivalFuelL: 0,
  serviceCeilingFt: 13000,
  calibration: [],
});

const calm = (distanceNm: number, altitudeFt: number): ProfileLeg => ({
  distanceNm,
  trueCourseDeg: 90,
  altitudeFt,
  cruiseSetting: '2400',
  windAt: () => ({ fromDeg: 0, speedKt: 0, temperatureC: null }),
});

describe('vertical profile', () => {
  it('climb by the table from 1000 to 5000 ft: 7.0 min, 4.1 L, 8.5 NM, TOC at 8.5 NM', () => {
    const result = buildProfile({
      legs: [calm(60, 5000)],
      startAltitudeFt: 1000,
      endAltitudeFt: 1000,
      qnhHpa: 1013.25,
      performance: performance(),
      descentRateFpm: 500,
    });
    const climb = result.segmentsByLeg[0][0];
    expect(climb.phase).toBe('CLIMB');
    expect(climb.timeMin).toBeCloseTo(7.0, 6);
    expect(climb.fuelL).toBeCloseTo(4.1, 6);
    expect(climb.toNm).toBeCloseTo(8.5, 6);
    expect(
      result.points.find((p) => p.label === 'TOC')?.distanceNm,
    ).toBeCloseTo(8.5, 6);
  });

  it('a 5 NM first leg: the climb goes on, TOC 3.5 NM into the next leg', () => {
    const result = buildProfile({
      legs: [calm(5, 5000), calm(50, 5000)],
      startAltitudeFt: 1000,
      endAltitudeFt: 1000,
      qnhHpa: 1013.25,
      performance: performance(),
      descentRateFpm: 500,
    });
    expect(result.segmentsByLeg[0]).toHaveLength(1);
    expect(result.segmentsByLeg[0][0].phase).toBe('CLIMB');
    const next = result.segmentsByLeg[1];
    expect(next[0].phase).toBe('CLIMB');
    expect(next[0].toNm).toBeCloseTo(3.5, 6);
    const total = result.segmentsByLeg
      .flat()
      .filter((s) => s.phase === 'CLIMB');
    expect(total.reduce((s, x) => s + x.timeMin, 0)).toBeCloseTo(7.0, 6);
  });

  it('descent at 500 ft/min and GS 100 kt from 5500 to 1000 ft: 9 min, TOD 15 NM before', () => {
    // Descent IAS giving a TAS of exactly 100 kt at the middle altitude.
    const ias = 100 * Math.sqrt(densityRatio(3250, isaTemperatureC(3250)));
    const result = buildProfile({
      legs: [calm(80, 5500)],
      startAltitudeFt: 5500,
      endAltitudeFt: 1000,
      qnhHpa: 1013.25,
      performance: performance(ias),
      descentRateFpm: 500,
    });
    const descent = result.segmentsByLeg[0].find((s) => s.phase === 'DESCENT');
    expect(descent.timeMin).toBeCloseTo(9, 6);
    expect(descent.toNm - descent.fromNm).toBeCloseTo(15, 6);
    expect(
      result.points.find((p) => p.label === 'TOD')?.distanceNm,
    ).toBeCloseTo(65, 6);
  });

  it('a headwind lengthens the ground distance of the climb', () => {
    const windy: ProfileLeg = {
      ...calm(60, 5000),
      windAt: () => ({ fromDeg: 90, speedKt: 20, temperatureC: null }),
    };
    const result = buildProfile({
      legs: [windy],
      startAltitudeFt: 1000,
      endAltitudeFt: 1000,
      qnhHpa: 1013.25,
      performance: performance(),
      descentRateFpm: 500,
    });
    expect(result.segmentsByLeg[0][0].toNm).toBeLessThan(8.5);
    expect(result.segmentsByLeg[0][0].timeMin).toBeCloseTo(7.0, 6);
  });

  it('cruise outside the manual tables is an error, never an extrapolation', () => {
    expect(() => cruiseAt(performance().cruise, '2400', 12000, 0)).toThrow(
      PerformanceError,
    );
  });
});

// A 10 x 10 NM square centred on 47N 2E, SFC - 2500 ft AMSL.
const origin = { lat: 47, lon: 2 };
const at = (eastNm: number, northNm: number) => {
  const east = direct(origin, 90, eastNm * METRES_PER_NM);
  return direct(east, 0, northNm * METRES_PER_NM);
};
const ring = (corners: [number, number][]) => {
  const points = corners.map(([e, n]) => at(e, n)).map((p) => [p.lon, p.lat]);
  return [[...points, points[0]]];
};
const zone = (
  overrides: Partial<AirspaceRecord> = {},
  geometry = ring([
    [-5, -5],
    [5, -5],
    [5, 5],
    [-5, 5],
  ]),
): AirspaceRecord => {
  const lats = geometry[0].map((p) => p[1]);
  const lons = geometry[0].map((p) => p[0]);
  return {
    id: 'z',
    name: 'TEST',
    type: 'CTR',
    icaoClass: 'D',
    floor: { ref: 'SFC', value: 0 },
    ceiling: { ref: 'AMSL', value: 2500 },
    activity: null,
    scheduleCode: 'H24',
    frequencies: [{ service: 'TWR', callsign: 'Test Tour', mhz: '118.000' }],
    remarks: null,
    geometry: [geometry],
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    ...overrides,
  };
};

const legThrough = (altitude: number, from = at(-20, 0), to = at(20, 0)) => ({
  from,
  to,
  distanceNm: inverse(from, to).distanceNm,
  altitudeAt: () => altitude,
});

describe('airspace crossings', () => {
  it('a leg at 3500 ft over a SFC-2500 ft zone: ABOVE, no crossing', () => {
    const [crossing] = legCrossings(legThrough(3500), [zone()], 1013.25, 300);
    expect(crossing.relation).toBe('ABOVE');
    expect(crossing.status).toBe('OK');
  });

  it('the same zone at 2000 ft: INSIDE, entry 15 NM and exit 25 NM (±0.05)', () => {
    const [crossing] = legCrossings(legThrough(2000), [zone()], 1013.25, 300);
    expect(crossing.relation).toBe('INSIDE');
    expect(Math.abs(crossing.entryNm - 15)).toBeLessThan(0.05);
    expect(Math.abs(crossing.exitNm - 25)).toBeLessThan(0.05);
    expect(crossing.status).toBe('WARNING');
    expect(crossing.requirement).toEqual({
      key: 'navplan.airspace.clearance',
      params: { radio: 'Test Tour 118.000' },
    });
  });

  it('at 2300 ft with a 300 ft margin: NEAR_CEILING', () => {
    const [crossing] = legCrossings(legThrough(2300), [zone()], 1013.25, 300);
    expect(crossing.relation).toBe('NEAR_CEILING');
  });

  it('floor FL065 on QNH 993 (5943 ft AMSL), leg at 6000 ft: INSIDE, NEAR_FLOOR with 300 ft', () => {
    const high = zone({
      floor: { ref: 'FL', value: 65 },
      ceiling: { ref: 'FL', value: 115 },
    });
    expect(legCrossings(legThrough(6000), [high], 993, 0)[0].relation).toBe(
      'INSIDE',
    );
    expect(legCrossings(legThrough(6000), [high], 993, 300)[0].relation).toBe(
      'NEAR_FLOOR',
    );
    // On 1013.25 the floor is 6500 ft: the same leg passes under it.
    expect(
      legCrossings(legThrough(6000), [high], 1013.25, 300)[0].relation,
    ).toBe('BELOW');
    expect(
      legCrossings(legThrough(6300), [high], 1013.25, 300)[0].relation,
    ).toBe('NEAR_FLOOR');
  });

  it('a U-shaped zone: a leg through the notch crosses nothing', () => {
    const u = zone(
      {},
      ring([
        [-5, -5],
        [5, -5],
        [5, 5],
        [2, 5],
        [2, -2],
        [-2, -2],
        [-2, 5],
        [-5, 5],
      ]),
    );
    const leg = legThrough(2000, at(0, 20), at(0, 0));
    expect(legCrossings(leg, [u], 1013.25, 300)).toHaveLength(0);
  });

  it('a leg touching a vertex: no false INSIDE', () => {
    const leg = legThrough(2000, at(-10, 0), at(-5, 5));
    const touching = legThrough(2000, at(-15, 10), at(5, -10));
    expect(legCrossings(leg, [zone()], 1013.25, 300)).toHaveLength(0);
    // The diagonal through two opposite corners does cross it.
    expect(legCrossings(touching, [zone()], 1013.25, 300)).toHaveLength(1);
  });

  it('a ceiling of 1000 ft ASFC: UNKNOWN_VERTICAL with its message', () => {
    const [crossing] = legCrossings(
      legThrough(1800),
      [
        zone({
          type: 'PROTECTED',
          icaoClass: null,
          ceiling: { ref: 'AGL', value: 1000 },
        }),
      ],
      1013.25,
      300,
    );
    expect(crossing.relation).toBe('UNKNOWN_VERTICAL');
    expect(crossing.status).toBe('WARNING');
    expect(crossing.requirement).toEqual({
      key: 'navplan.airspace.protected',
      params: { limit: '1000 ft ASFC' },
    });
  });

  it('an R zone without schedule: activity unknown, WARNING, check NOTAM / SUP AIP', () => {
    const [crossing] = legCrossings(
      legThrough(2000),
      [zone({ type: 'R', icaoClass: null, scheduleCode: null })],
      1013.25,
      300,
    );
    expect(crossing.activityKnown).toBe(false);
    expect(crossing.status).toBe('WARNING');
    expect(crossing.requirement.key).toBe('navplan.airspace.restricted');
  });

  it('a P zone is blocking', () => {
    const [crossing] = legCrossings(
      legThrough(2000),
      [zone({ type: 'P', icaoClass: null })],
      1013.25,
      300,
    );
    expect(crossing.status).toBe('BLOCKING');
  });

  it('two parts of a multipolygon give two crossings in order', () => {
    const two = zone(
      {},
      ring([
        [-5, -5],
        [-1, -5],
        [-1, 5],
        [-5, 5],
      ]),
    );
    two.geometry.push(
      ring([
        [1, -5],
        [5, -5],
        [5, 5],
        [1, 5],
      ]),
    );
    const intervals = lateralIntervals(at(-20, 0), at(20, 0), 40, two.geometry);
    expect(intervals).toHaveLength(2);
    expect(intervals[0][0]).toBeLessThan(intervals[1][0]);
  });
});

// An area published without an outline (géométrie inconnue): empty
// geometry, its point as the box, or the whole world when not located.
const pointOnly = (
  name: string,
  point: { lat: number; lon: number } | null,
  overrides: Partial<AirspaceRecord> = {},
): AirspaceRecord =>
  zone({
    id: name,
    name,
    type: 'PROTECTED',
    icaoClass: null,
    ceiling: { ref: 'AGL', value: 3300 },
    geometry: [],
    ...(point
      ? {
          minLat: point.lat,
          maxLat: point.lat,
          minLon: point.lon,
          maxLon: point.lon,
        }
      : UNLOCATED_BOX),
    ...overrides,
  });

describe('areas without an outline', () => {
  const leg = legThrough(2500);
  const flight = { minAltFt: 0, maxAltFt: 2500 };

  it('are never crossed laterally but are listed when their point is near the route', () => {
    const near = pointOnly('PRN NEAR', at(0, 10));
    const far = pointOnly('PRN FAR', at(0, 40));
    expect(legCrossings(leg, [near, far], 1013.25, 300)).toEqual([]);
    const listed = unverifiedAirspaces(
      [leg],
      [near, far, zone()],
      flight,
      1013.25,
      300,
    );
    expect(listed.map((u) => u.airspace.name)).toEqual(['PRN NEAR']);
    expect(listed[0].distanceNm).toBeCloseTo(10, 1);
    expect(referencePointOf(near)?.lat).toBeCloseTo(at(0, 10).lat, 9);
    expect(
      unverifiedAirspaces(
        [leg],
        [pointOnly('PRN EDGE', at(0, UNVERIFIED_AIRSPACE_NEAR_NM - 0.5))],
        flight,
        1013.25,
        300,
      ),
    ).toHaveLength(1);
  });

  it('an area that cannot be located is always listed, unless the flight stays below its floor', () => {
    const words = pointOnly('LTA FRANCE 2', null, {
      type: 'CTA',
      floor: { ref: 'FL', value: 115 },
      ceiling: { ref: 'FL', value: 195 },
    });
    const low = pointOnly('PRN SOMEWHERE', null);
    const listed = unverifiedAirspaces(
      [leg],
      [words, low],
      flight,
      1013.25,
      300,
    );
    expect(listed).toEqual([{ airspace: low, distanceNm: null }]);
    // Navigation data too old: no vertical filter.
    expect(
      unverifiedAirspaces([leg], [words, low], null, 1013.25, 300),
    ).toHaveLength(2);
  });

  it('a plan near one says so in its result and is not "Conforme"', () => {
    const middle = {
      lat: (LFRS.lat + LFRN.lat) / 2,
      lon: (LFRS.lon + LFRN.lon) / 2 + 0.1,
    };
    const park = pointOnly('PRN 390 PARC NATIONAL DES CEVENNES', middle);
    const plan = computeFlightPlan(engineInput({ airspaces: [park] }));
    expect(plan.unverifiedAirspaces).toEqual([
      expect.objectContaining({
        airspace: park,
        status: 'WARNING',
        message: {
          key: 'navplan.airspace.unverified',
          params: { name: 'PRN 390 PARC NATIONAL DES CEVENNES' },
        },
      }),
    ]);
    expect(plan.notices).toContainEqual(
      expect.objectContaining({
        code: 'AIRSPACE_UNVERIFIED',
        status: 'WARNING',
      }),
    );
    expect(plan.status).not.toBe('OK');
    const rendered = renderResult(plan, 'fr');
    expect(rendered.unverifiedAirspaces[0].message).toBe(
      'Zone non vérifiée : PRN 390 PARC NATIONAL DES CEVENNES, tracé non disponible — la repérer sur la carte en vigueur.',
    );
    expect(rendered.unverifiedAirspaces[0].airspace.outlineKnown).toBe(false);
    expect(renderResult(plan, 'en').unverifiedAirspaces[0].message).toBe(
      'Unverified area: PRN 390 PARC NATIONAL DES CEVENNES, outline not available — find it on the current chart.',
    );
    const without = computeFlightPlan(engineInput());
    expect(without.unverifiedAirspaces).toEqual([]);
    expect(without.notices.some((n) => n.code === 'AIRSPACE_UNVERIFIED')).toBe(
      false,
    );
  });
});
