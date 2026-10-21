import { LatLon, pointAlong } from './geodesy';
import { positionAlongLeg } from './airspace-intersection';
import { ObstacleRecord } from './obstacles';
import { CheckStatus } from './types';

// Terrain under the route and the minimum safe altitude (MSA) of each leg.
//
// The terrain is a grid of the HIGHEST elevation in each cell (about
// 30 arc-seconds, ft AMSL), built from the Copernicus DEM GLO-90 by
// scripts/terrain.ts. The DEM is a surface model: forests and buildings
// are included, which errs on the safe side for an MSA.
//
// MSA of a leg = the highest point (terrain or SIA obstacle) within the
// club's corridor either side of the track, plus the club's margin,
// rounded up to the next 100 ft. Only the planned altitude of the leg is
// judged against it: the climb and the descent near the aerodromes are
// left to the VAC, as for the obstacles (obstacles.ts). Where the corridor
// leaves the grid, the MSA is unknown, never 0.

export const TERRAIN_SOURCE = 'Copernicus DEM GLO-90';
export const TERRAIN_ATTRIBUTION =
  "Contient des données Copernicus DEM GLO-90 © DLR e.V. 2010-2014 et © Airbus Defence and Space GmbH 2014-2018, fournies dans le cadre de COPERNICUS par l'Union européenne et l'ESA";

export const DEFAULT_MSA_CORRIDOR_NM = 5;
export const DEFAULT_MSA_MARGIN_FT = 1000;
// The terrain profile: one sample every PROFILE_STEP_NM along the route,
// the highest cell within PROFILE_BAND_NM either side of the track.
export const PROFILE_STEP_NM = 0.5;
export const PROFILE_BAND_NM = 0.5;
// Long legs are cut into pieces short enough for a flat projection.
const PIECE_NM = 10;

export interface TerrainGrid {
  // Edges of the grid, degrees; row 0 is the northern row.
  south: number;
  west: number;
  north: number;
  east: number;
  cellDeg: number;
  rows: number;
  cols: number;
  // Highest elevation in each cell, ft AMSL, row after row.
  data: Int16Array;
  // A cell without data (never in a complete grid).
  noData: number;
}

export interface TerrainSourceInfo {
  name: string;
  attribution: string;
  cellArcSec: number;
}

export const terrainSourceInfo = (grid: TerrainGrid): TerrainSourceInfo => ({
  name: TERRAIN_SOURCE,
  attribution: TERRAIN_ATTRIBUTION,
  cellArcSec: Math.round(grid.cellDeg * 3600),
});

export type MsaState = 'KNOWN' | 'UNKNOWN';

export interface LegTerrain {
  state: MsaState;
  corridorNm: number;
  marginFt: number;
  // Highest cell of the grid in the corridor (null: unknown).
  highestTerrainFt: number | null;
  highestTerrainLat: number | null;
  highestTerrainLon: number | null;
  highestTerrainAlongNm: number | null;
  // Highest SIA obstacle in the corridor (null: none).
  highestObstacleFt: number | null;
  highestObstacleIdent: string | null;
  msaFt: number | null;
  // Planned altitude minus the MSA (negative: below).
  marginToMsaFt: number | null;
  status: CheckStatus;
}

export interface TerrainProfilePoint {
  distanceNm: number;
  // Highest terrain near the track (null: outside the grid).
  terrainFt: number | null;
  // Highest obstacle near the track at this point (null: none).
  obstacleFt: number | null;
}

interface Highest {
  elevationFt: number;
  lat: number;
  lon: number;
  alongNm: number;
}

const cellValue = (grid: TerrainGrid, row: number, col: number) =>
  grid.data[row * grid.cols + col];

const NM_PER_DEG = 60;

// Highest cell within `halfWidthNm` of the segment a-b (flat projection
// around its middle: segments are at most PIECE_NM long). A cell counts
// when any part of it may be within the corridor. `covered` is false as
// soon as part of the corridor is outside the grid or without data.
function highestNearSegment(
  grid: TerrainGrid,
  a: LatLon,
  b: LatLon,
  halfWidthNm: number,
  startNm: number,
  lengthNm: number,
): { highest: Highest | null; covered: boolean } {
  const lat0 = (a.lat + b.lat) / 2;
  const lon0 = (a.lon + b.lon) / 2;
  const cosLat = Math.cos((lat0 * Math.PI) / 180);
  const x = (lon: number) => (lon - lon0) * NM_PER_DEG * cosLat;
  const y = (lat: number) => (lat - lat0) * NM_PER_DEG;
  const ax = x(a.lon);
  const ay = y(a.lat);
  const dx = x(b.lon) - ax;
  const dy = y(b.lat) - ay;
  const length2 = dx * dx + dy * dy;
  // Half the diagonal of a cell, in NM: the reach of its centre.
  const halfDiag =
    (Math.hypot(grid.cellDeg * cosLat, grid.cellDeg) * NM_PER_DEG) / 2;
  const reach = halfWidthNm + halfDiag;
  const latMargin = reach / NM_PER_DEG;
  const lonMargin = reach / (NM_PER_DEG * Math.max(cosLat, 0.01));
  const minLat = Math.min(a.lat, b.lat) - latMargin;
  const maxLat = Math.max(a.lat, b.lat) + latMargin;
  const minLon = Math.min(a.lon, b.lon) - lonMargin;
  const maxLon = Math.max(a.lon, b.lon) + lonMargin;
  let covered =
    minLat >= grid.south &&
    maxLat <= grid.north &&
    minLon >= grid.west &&
    maxLon <= grid.east;
  const firstRow = Math.max(
    0,
    Math.floor((grid.north - maxLat) / grid.cellDeg),
  );
  const lastRow = Math.min(
    grid.rows - 1,
    Math.floor((grid.north - minLat) / grid.cellDeg),
  );
  const firstCol = Math.max(0, Math.floor((minLon - grid.west) / grid.cellDeg));
  const lastCol = Math.min(
    grid.cols - 1,
    Math.floor((maxLon - grid.west) / grid.cellDeg),
  );
  let highest: Highest | null = null;
  for (let row = firstRow; row <= lastRow; row++) {
    const lat = grid.north - (row + 0.5) * grid.cellDeg;
    const py = y(lat) - ay;
    for (let col = firstCol; col <= lastCol; col++) {
      const lon = grid.west + (col + 0.5) * grid.cellDeg;
      const px = x(lon) - ax;
      const t =
        length2 === 0
          ? 0
          : Math.min(1, Math.max(0, (px * dx + py * dy) / length2));
      const offset = Math.hypot(px - t * dx, py - t * dy);
      if (offset > reach) continue;
      const value = cellValue(grid, row, col);
      if (value === grid.noData) {
        covered = false;
        continue;
      }
      if (!highest || value > highest.elevationFt) {
        highest = {
          elevationFt: value,
          lat,
          lon,
          alongNm: startNm + t * lengthNm,
        };
      }
    }
  }
  return { highest, covered };
}

// The highest cell within `halfWidthNm` of the leg from-to (geodesic),
// with `covered` false when part of that corridor is outside the grid.
export function highestTerrainNearLeg(
  grid: TerrainGrid,
  from: LatLon,
  to: LatLon,
  distanceNm: number,
  halfWidthNm: number,
): { highest: Highest | null; covered: boolean } {
  const pieces = Math.max(1, Math.ceil(distanceNm / PIECE_NM));
  let start: LatLon = from;
  let highest: Highest | null = null;
  let covered = true;
  for (let i = 1; i <= pieces; i++) {
    const end =
      i === pieces ? to : pointAlong(from, to, (distanceNm * i) / pieces);
    const near = highestNearSegment(
      grid,
      start,
      end,
      halfWidthNm,
      (distanceNm * (i - 1)) / pieces,
      distanceNm / pieces,
    );
    covered = covered && near.covered;
    if (
      near.highest &&
      (!highest || near.highest.elevationFt > highest.elevationFt)
    )
      highest = near.highest;
    start = end;
  }
  return { highest, covered };
}

// A box around the leg wide enough for the corridor.
function corridorBox(from: LatLon, to: LatLon, nm: number) {
  const latMargin = nm / NM_PER_DEG;
  const lonMargin =
    latMargin /
    Math.max(
      Math.cos(
        (Math.max(Math.abs(from.lat), Math.abs(to.lat)) * Math.PI) / 180,
      ),
      0.01,
    );
  return {
    minLat: Math.min(from.lat, to.lat) - latMargin,
    maxLat: Math.max(from.lat, to.lat) + latMargin,
    minLon: Math.min(from.lon, to.lon) - lonMargin,
    maxLon: Math.max(from.lon, to.lon) + lonMargin,
  };
}

// MSA = highest point + margin, rounded up to the next 100 ft.
export const minimumSafeAltitudeFt = (highestFt: number, marginFt: number) =>
  Math.ceil((highestFt + marginFt) / 100) * 100;

export function legTerrain(
  grid: TerrainGrid | null,
  from: LatLon,
  to: LatLon,
  distanceNm: number,
  altitudeFt: number,
  obstacles: ObstacleRecord[],
  corridorNm: number,
  marginFt: number,
): LegTerrain {
  const near = grid
    ? highestTerrainNearLeg(grid, from, to, distanceNm, corridorNm)
    : { highest: null, covered: false };
  let obstacle: ObstacleRecord | null = null;
  const box = corridorBox(from, to, corridorNm);
  for (const candidate of obstacles) {
    if (obstacle && candidate.amslFt <= obstacle.amslFt) continue;
    if (
      candidate.lat < box.minLat ||
      candidate.lat > box.maxLat ||
      candidate.lon < box.minLon ||
      candidate.lon > box.maxLon
    )
      continue;
    if (
      positionAlongLeg(candidate, from, to, distanceNm).offsetNm <= corridorNm
    )
      obstacle = candidate;
  }
  const base = {
    corridorNm,
    marginFt,
    highestObstacleFt: obstacle?.amslFt ?? null,
    highestObstacleIdent: obstacle?.ident ?? null,
  };
  if (!near.covered || !near.highest) {
    return {
      ...base,
      state: 'UNKNOWN',
      highestTerrainFt: null,
      highestTerrainLat: null,
      highestTerrainLon: null,
      highestTerrainAlongNm: null,
      msaFt: null,
      marginToMsaFt: null,
      status: 'WARNING',
    };
  }
  const highest = Math.max(near.highest.elevationFt, obstacle?.amslFt ?? 0);
  const msaFt = minimumSafeAltitudeFt(highest, marginFt);
  return {
    ...base,
    state: 'KNOWN',
    highestTerrainFt: near.highest.elevationFt,
    highestTerrainLat: Math.round(near.highest.lat * 10000) / 10000,
    highestTerrainLon: Math.round(near.highest.lon * 10000) / 10000,
    highestTerrainAlongNm: Math.round(near.highest.alongNm * 10) / 10,
    msaFt,
    marginToMsaFt: Math.round(altitudeFt - msaFt),
    status: altitudeFt < msaFt ? 'WARNING' : 'OK',
  };
}

// Highest cell within `bandNm` of a point (null: outside the grid).
function highestAround(
  grid: TerrainGrid,
  point: LatLon,
  bandNm: number,
): number | null {
  const cosLat = Math.max(Math.cos((point.lat * Math.PI) / 180), 0.01);
  const latMargin = bandNm / NM_PER_DEG;
  const lonMargin = bandNm / (NM_PER_DEG * cosLat);
  if (
    point.lat - latMargin < grid.south ||
    point.lat + latMargin > grid.north ||
    point.lon - lonMargin < grid.west ||
    point.lon + lonMargin > grid.east
  )
    return null;
  const firstRow = Math.floor(
    (grid.north - point.lat - latMargin) / grid.cellDeg,
  );
  const lastRow = Math.min(
    grid.rows - 1,
    Math.floor((grid.north - point.lat + latMargin) / grid.cellDeg),
  );
  const firstCol = Math.floor(
    (point.lon - lonMargin - grid.west) / grid.cellDeg,
  );
  const lastCol = Math.min(
    grid.cols - 1,
    Math.floor((point.lon + lonMargin - grid.west) / grid.cellDeg),
  );
  let highest: number | null = null;
  for (let row = Math.max(0, firstRow); row <= lastRow; row++)
    for (let col = Math.max(0, firstCol); col <= lastCol; col++) {
      const value = cellValue(grid, row, col);
      if (value === grid.noData) return null;
      if (highest === null || value > highest) highest = value;
    }
  return highest;
}

// The terrain along the route, for the vertical profile chart: one sample
// every PROFILE_STEP_NM, with the highest obstacle near the track.
export function terrainProfile(
  grid: TerrainGrid | null,
  legs: { from: LatLon; to: LatLon; distanceNm: number }[],
  obstacles: ObstacleRecord[],
): TerrainProfilePoint[] {
  const points: TerrainProfilePoint[] = [];
  let start = 0;
  for (const [i, leg] of legs.entries()) {
    const steps = Math.max(1, Math.round(leg.distanceNm / PROFILE_STEP_NM));
    const samples: TerrainProfilePoint[] = [];
    // The first sample of a leg is the last of the one before.
    for (let s = i === 0 ? 0 : 1; s <= steps; s++) {
      const along = (leg.distanceNm * s) / steps;
      const point =
        s === 0
          ? leg.from
          : s === steps
            ? leg.to
            : pointAlong(leg.from, leg.to, along);
      samples.push({
        distanceNm: Math.round((start + along) * 100) / 100,
        terrainFt: grid ? highestAround(grid, point, PROFILE_BAND_NM) : null,
        obstacleFt: null,
      });
    }
    const box = corridorBox(leg.from, leg.to, PROFILE_BAND_NM);
    for (const obstacle of obstacles) {
      if (
        obstacle.lat < box.minLat ||
        obstacle.lat > box.maxLat ||
        obstacle.lon < box.minLon ||
        obstacle.lon > box.maxLon
      )
        continue;
      const { offsetNm, alongNm } = positionAlongLeg(
        obstacle,
        leg.from,
        leg.to,
        leg.distanceNm,
      );
      if (offsetNm > PROFILE_BAND_NM) continue;
      const distance = start + alongNm;
      const sample = samples.reduce(
        (a, b) =>
          Math.abs(b.distanceNm - distance) < Math.abs(a.distanceNm - distance)
            ? b
            : a,
        samples[0],
      );
      sample.obstacleFt = Math.max(sample.obstacleFt ?? 0, obstacle.amslFt);
    }
    points.push(...samples);
    start += leg.distanceNm;
  }
  return points;
}
