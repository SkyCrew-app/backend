import { readFileSync } from 'fs';
import { join } from 'path';
import {
  direct,
  inverse,
  legGeometry,
  METRES_PER_NM,
  pointAlong,
} from '../geodesy';
import { magneticField, WmmExpiredError, declinationAt } from '../wmm';
import {
  flightLevelToAltitudeFt,
  pressureAltitudeFt,
  trueAirspeedKt,
} from '../atmosphere';
import { suggestedVfrAltitudeFt } from '../semicircular';
import { GEOD_TEST_LINES } from './fixtures/geodtest';

const LFPN = { lat: 48.7519, lon: 2.1061 };
const LFRB = { lat: 48.4479, lon: -4.4185 };

describe('geodesy (WGS84)', () => {
  it('LFPN -> LFRB: 260.40 NM, initial 268.43°, final 263.54° (GeographicLib)', () => {
    const leg = inverse(LFPN, LFRB);
    expect(leg.distanceNm).toBeCloseTo(260.4, 2);
    expect(leg.initialCourseDeg).toBeCloseTo(268.43, 2);
    expect(leg.finalCourseDeg).toBeCloseTo(263.54, 2);
    // The spherical Haversine of the old generator said 259.62 NM.
    expect(Math.abs(leg.distanceNm - 259.62)).toBeGreaterThan(0.5);
  });

  const lines = GEOD_TEST_LINES.trim()
    .split('\n')
    .map((line) => line.trim().split(/\s+/).map(Number));

  it.each(lines)(
    'GeodTest %f %f az %f: inverse within 1 mm',
    (lat1, lon1, azi1, lat2, lon2, azi2, s12) => {
      const result = inverse(
        { lat: lat1, lon: lon1 },
        { lat: lat2, lon: lon2 },
      );
      expect(Math.abs(result.distanceM - s12)).toBeLessThan(0.001);
      const angle = (a: number, b: number) =>
        Math.abs(((a - b + 540) % 360) - 180);
      expect(angle(result.initialCourseDeg, azi1)).toBeLessThan(1e-6);
      expect(angle(result.finalCourseDeg, azi2)).toBeLessThan(1e-6);
    },
  );

  it.each(lines)(
    'GeodTest %f %f az %f: direct within 1 mm',
    (lat1, lon1, azi1, lat2, lon2, _azi2, s12) => {
      const point = direct({ lat: lat1, lon: lon1 }, azi1, s12);
      const error = inverse(point, { lat: lat2, lon: lon2 }).distanceM;
      expect(error).toBeLessThan(0.001);
    },
  );

  it('the point at 50 % of a leg splits it into two equal halves (1 m)', () => {
    const total = inverse(LFPN, LFRB).distanceM;
    const middle = pointAlong(LFPN, LFRB, total / 2 / METRES_PER_NM);
    expect(
      Math.abs(
        inverse(LFPN, middle).distanceM - inverse(middle, LFRB).distanceM,
      ),
    ).toBeLessThan(1);
    expect(legGeometry(LFPN, LFRB).midCourseDeg).toBeGreaterThan(263.54);
    expect(legGeometry(LFPN, LFRB).midCourseDeg).toBeLessThan(268.43);
  });
});

describe('WMM2025', () => {
  const rows = readFileSync(
    join(__dirname, 'fixtures', 'WMM2025_TestValues.txt'),
    'utf8',
  )
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => line.trim().split(/\s+/).map(Number));

  it('has the 100 official NOAA test points', () => {
    expect(rows).toHaveLength(100);
  });

  it.each(rows)(
    '%f h=%f km lat %f lon %f: D, I and X, Y, Z, H, F as published',
    (year, height, lat, lon, D, I, H, X, Y, Z, F) => {
      const field = magneticField(lat, lon, height, year);
      expect(Math.abs(field.declinationDeg - D)).toBeLessThanOrEqual(0.006);
      expect(Math.abs(field.inclinationDeg - I)).toBeLessThanOrEqual(0.006);
      for (const [mine, published] of [
        [field.x, X],
        [field.y, Y],
        [field.z, Z],
        [field.h, H],
        [field.f, F],
      ]) {
        expect(Math.abs(mine - published)).toBeLessThan(0.01);
      }
    },
  );

  it.each([
    ['LFPN', 48.7519, 2.1061, 2.02],
    ['LFRB', 48.4479, -4.4185, 0.06],
    ['LFBO', 43.6293, 1.3638, 1.92],
    ['LFMN', 43.6584, 7.2159, 3.22],
    ['LFSB', 47.59, 7.529, 3.42],
  ])('%s on 2026-10-16: %f°E', (_name, lat, lon, expected) => {
    expect(
      declinationAt(
        lat as number,
        lon as number,
        new Date('2026-10-16T00:00:00Z'),
      ),
    ).toBeCloseTo(expected as number, 1);
    expect(
      Math.abs(
        declinationAt(
          lat as number,
          lon as number,
          new Date('2026-10-16T00:00:00Z'),
        ) - (expected as number),
      ),
    ).toBeLessThan(0.01);
  });

  it('refuses dates outside 2025.0-2030.0 (WMM_EXPIRED)', () => {
    expect(() => magneticField(48, 2, 0, 2030.0)).toThrow(WmmExpiredError);
    expect(() => magneticField(48, 2, 0, 2024.99)).toThrow(WmmExpiredError);
  });
});

describe('atmosphere', () => {
  it('pressure altitude: 2500 ft on QNH 1003 is 2781 ft', () => {
    expect(Math.abs(pressureAltitudeFt(2500, 1003) - 2781)).toBeLessThanOrEqual(
      1,
    );
    expect(pressureAltitudeFt(2500, 1013.25)).toBeCloseTo(2500, 6);
  });

  it('TAS: CAS 100 kt at 5000 ft is 107.73 kt ISA, 110.60 kt ISA+15', () => {
    expect(Math.abs(trueAirspeedKt(100, 5000) - 107.73)).toBeLessThanOrEqual(
      0.05,
    );
    expect(
      Math.abs(trueAirspeedKt(100, 5000, 15 - 9.9 + 15) - 110.6),
    ).toBeLessThanOrEqual(0.05);
  });

  it('FL065 on QNH 993 is 5943 ft AMSL', () => {
    expect(
      Math.abs(flightLevelToAltitudeFt(65, 993) - 5943),
    ).toBeLessThanOrEqual(1);
  });
});

describe('VFR semicircular suggestion (SERA.5005(g))', () => {
  it('odd + 500 eastbound, even + 500 westbound, nothing below 3000 ft', () => {
    expect(suggestedVfrAltitudeFt(90, 3200)).toBe(3500);
    expect(suggestedVfrAltitudeFt(270, 3200)).toBe(4500);
    expect(suggestedVfrAltitudeFt(179.9, 5600)).toBe(5500);
    expect(suggestedVfrAltitudeFt(180, 5600)).toBe(6500);
    expect(suggestedVfrAltitudeFt(90, 2500)).toBeNull();
  });
});
