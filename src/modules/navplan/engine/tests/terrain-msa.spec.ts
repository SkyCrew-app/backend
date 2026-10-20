import { existsSync } from 'fs';
import { computeFlightPlan } from '../engine';
import { direct, inverse, METRES_PER_NM, pointAlong } from '../geodesy';
import {
  highestTerrainNearLeg,
  legTerrain,
  minimumSafeAltitudeFt,
  TERRAIN_ATTRIBUTION,
  TerrainGrid,
  terrainProfile,
} from '../terrain';
import { ObstacleRecord } from '../obstacles';
import {
  decodeTerrainGrid,
  encodeTerrainGrid,
  loadTerrainGrid,
  terrainFilePath,
} from '../../terrain/terrain-file';
import { engineInput, LFRN, LFRS } from './fixture';

// A grid of 30 arc-second cells, flat at `ground` ft, with peaks.
const grid = (
  box: { south: number; west: number; north: number; east: number },
  ground: number,
  peaks: { lat: number; lon: number; ft: number }[] = [],
): TerrainGrid => {
  const cellDeg = 1 / 120;
  const rows = Math.round((box.north - box.south) / cellDeg);
  const cols = Math.round((box.east - box.west) / cellDeg);
  const data = new Int16Array(rows * cols).fill(ground);
  for (const peak of peaks) {
    const row = Math.floor((box.north - peak.lat) / cellDeg);
    const col = Math.floor((peak.lon - box.west) / cellDeg);
    data[row * cols + col] = peak.ft;
  }
  return { ...box, cellDeg, rows, cols, data, noData: -32768 };
};

const FROM = { lat: 46.2, lon: 1.2 };
const TO = { lat: 46.8, lon: 1.8 };
const DISTANCE = inverse(FROM, TO).distanceNm;
const BOX = { south: 45, west: 0, north: 48, east: 3 };

const obstacle = (
  lat: number,
  lon: number,
  amslFt: number,
): ObstacleRecord => ({
  ident: `OBS-${amslFt}`,
  type: 'Eolienne',
  lat,
  lon,
  amslFt,
  aglFt: 500,
  count: 1,
  lighting: null,
});

// A point `offsetNm` to the right of the track, halfway.
const besideTrack = (offsetNm: number) => {
  const middle = pointAlong(FROM, TO, DISTANCE / 2);
  // The track runs about north-east: the right is about south-east.
  const point = direct(middle, 135, offsetNm * METRES_PER_NM);
  return { lat: point.lat, lon: point.lon };
};

describe('minimum safe altitude', () => {
  it('rounds the highest point plus the margin up to the next 100 ft', () => {
    expect(minimumSafeAltitudeFt(2300, 1000)).toBe(3300);
    expect(minimumSafeAltitudeFt(2301, 1000)).toBe(3400);
    expect(minimumSafeAltitudeFt(0, 1000)).toBe(1000);
  });

  it('takes the highest terrain in the corridor and warns below the MSA', () => {
    const peak = besideTrack(3);
    const terrain = legTerrain(
      grid(BOX, 500, [{ ...peak, ft: 2600 }]),
      FROM,
      TO,
      DISTANCE,
      3500,
      [],
      5,
      1000,
    );
    expect(terrain).toMatchObject({
      state: 'KNOWN',
      highestTerrainFt: 2600,
      msaFt: 3600,
      marginToMsaFt: -100,
      status: 'WARNING',
    });
    expect(terrain.highestTerrainLat).toBeCloseTo(peak.lat, 1);
    expect(terrain.highestTerrainAlongNm).toBeGreaterThan(15);
    expect(terrain.highestTerrainAlongNm).toBeLessThan(30);
  });

  it('leaves out a peak beyond the corridor', () => {
    const terrain = legTerrain(
      grid(BOX, 500, [{ ...besideTrack(7), ft: 6000 }]),
      FROM,
      TO,
      DISTANCE,
      2000,
      [],
      5,
      1000,
    );
    expect(terrain).toMatchObject({
      highestTerrainFt: 500,
      msaFt: 1500,
      marginToMsaFt: 500,
      status: 'OK',
    });
  });

  it('counts the obstacles within the corridor, not those outside', () => {
    const near = besideTrack(4);
    const far = besideTrack(6);
    const terrain = legTerrain(
      grid(BOX, 500),
      FROM,
      TO,
      DISTANCE,
      2500,
      [obstacle(near.lat, near.lon, 1720), obstacle(far.lat, far.lon, 4000)],
      5,
      1000,
    );
    expect(terrain).toMatchObject({
      highestTerrainFt: 500,
      highestObstacleFt: 1720,
      highestObstacleIdent: 'OBS-1720',
      msaFt: 2800,
      status: 'WARNING',
    });
  });

  it('is unknown, never 0, outside the grid or without a grid', () => {
    const outside = legTerrain(
      grid({ south: 46, west: 1, north: 46.5, east: 1.5 }, 0),
      FROM,
      TO,
      DISTANCE,
      2500,
      [],
      5,
      1000,
    );
    expect(outside).toMatchObject({
      state: 'UNKNOWN',
      msaFt: null,
      highestTerrainFt: null,
      status: 'WARNING',
    });
    expect(
      legTerrain(null, FROM, TO, DISTANCE, 2500, [], 5, 1000),
    ).toMatchObject({ state: 'UNKNOWN', msaFt: null, status: 'WARNING' });
  });

  it('is unknown when part of the corridor has no data', () => {
    const holed = grid(BOX, 500);
    const middle = pointAlong(FROM, TO, DISTANCE / 2);
    holed.data[
      Math.floor((holed.north - middle.lat) * 120) * holed.cols +
        Math.floor((middle.lon - holed.west) * 120)
    ] = holed.noData;
    expect(highestTerrainNearLeg(holed, FROM, TO, DISTANCE, 5).covered).toBe(
      false,
    );
  });

  it('draws the terrain along the route every half nautical mile', () => {
    const middle = pointAlong(FROM, TO, DISTANCE / 2);
    const profile = terrainProfile(
      grid(BOX, 300, [{ ...middle, ft: 1800 }]),
      [{ from: FROM, to: TO, distanceNm: DISTANCE }],
      [obstacle(middle.lat, middle.lon, 2100)],
    );
    expect(profile.length).toBe(Math.round(DISTANCE / 0.5) + 1);
    expect(profile[0].distanceNm).toBe(0);
    expect(profile[profile.length - 1].distanceNm).toBeCloseTo(DISTANCE, 1);
    expect(Math.max(...profile.map((p) => p.terrainFt ?? 0))).toBe(1800);
    expect(profile.filter((p) => p.obstacleFt === 2100)).toHaveLength(1);
    expect(
      terrainProfile(
        null,
        [{ from: FROM, to: TO, distanceNm: DISTANCE }],
        [],
      ).every((p) => p.terrainFt === null),
    ).toBe(true);
  });
});

describe('terrain grid file', () => {
  it('reads back what it wrote, negative values included', () => {
    const original = grid({ south: 45, west: 5, north: 45.1, east: 5.2 }, -12, [
      { lat: 45.05, lon: 5.1, ft: 15724 },
    ]);
    const { grid: back, header } = decodeTerrainGrid(
      encodeTerrainGrid(original, {
        source: 'test',
        attribution: TERRAIN_ATTRIBUTION,
        builtAt: '2026-10-20T00:00:00Z',
      }),
    );
    expect(header.unit).toBe('ft');
    expect(back.rows).toBe(original.rows);
    expect(Array.from(back.data)).toEqual(Array.from(original.data));
  });

  it('ships a grid of metropolitan France and Corsica', () => {
    const path = terrainFilePath();
    expect(path && existsSync(path)).toBeTruthy();
    const shipped = loadTerrainGrid(path)!;
    expect(shipped.south).toBeLessThanOrEqual(41);
    expect(shipped.north).toBeGreaterThanOrEqual(51.5);
    expect(shipped.west).toBeLessThanOrEqual(-5.5);
    expect(shipped.east).toBeGreaterThanOrEqual(9.6);
    const at = (lat: number, lon: number) =>
      shipped.data[
        Math.floor((shipped.north - lat) / shipped.cellDeg) * shipped.cols +
          Math.floor((lon - shipped.west) / shipped.cellDeg)
      ];
    // Mont Blanc (4806 m), the Bay of Biscay.
    expect(at(45.8326, 6.8652)).toBeGreaterThan(15500);
    expect(at(46, -4)).toBe(0);
  });
});

describe('minimum safe altitude in the plan', () => {
  const flat = grid({ south: 46, west: -3, north: 49, east: 0 }, 400);

  it('gives each leg its MSA and the route its terrain profile', () => {
    const result = computeFlightPlan(engineInput({ terrain: flat }));
    expect(result.legs[0].terrain).toMatchObject({
      state: 'KNOWN',
      highestTerrainFt: 400,
      msaFt: 1400,
      status: 'OK',
    });
    expect(result.terrainProfile!.length).toBeGreaterThan(100);
    expect(result.terrainSource?.attribution).toContain('Copernicus');
    expect(result.notices.map((n) => n.code)).not.toContain('MSA_BELOW');
  });

  it('warns, with the gap, when a leg is planned below its MSA', () => {
    const result = computeFlightPlan(
      engineInput({
        terrain: flat,
        legs: [{ altitudeFt: 1200, cruiseSetting: null, windOverride: null }],
      }),
    );
    const notice = result.notices.find((n) => n.code === 'MSA_BELOW');
    expect(notice).toMatchObject({
      status: 'WARNING',
      message: {
        key: 'navplan.notice.msaBelow',
        params: { leg: `${LFRS.ident} → ${LFRN.ident}`, msa: 1400, below: 200 },
      },
    });
    expect(result.status).not.toBe('OK');
  });

  it('says so when the MSA is unknown', () => {
    const result = computeFlightPlan(engineInput({ terrain: null }));
    expect(result.legs[0].terrain?.msaFt).toBeNull();
    expect(result.notices.find((n) => n.code === 'MSA_UNKNOWN')).toMatchObject({
      status: 'WARNING',
    });
  });
});
