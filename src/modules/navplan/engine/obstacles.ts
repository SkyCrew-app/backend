import { positionAlongLeg } from './airspace-intersection';
import { inverse, LatLon } from './geodesy';
import { CheckStatus } from './types';

// Obstacles of the SIA (wind turbines, pylons, masts...) near each leg.
// SERA.5005(f): 500 ft above the highest obstacle within 150 m of the
// aircraft (1000 ft within 600 m over congested areas). Skycrew warns, on
// each leg, of the obstacles within OBSTACLE_CORRIDOR_NM of the route
// whose top is less than OBSTACLE_MARGIN_FT below the planned altitude of
// the leg (climb and descent near the aerodromes are left to the VAC).
// A wind farm counts once: obstacles of the same type within
// OBSTACLE_GROUP_NM of the highest one are grouped.

export const OBSTACLE_CORRIDOR_NM = 2;
export const OBSTACLE_MARGIN_FT = 500;
export const OBSTACLE_GROUP_NM = 1;

export interface ObstacleRecord {
  ident: string;
  type: string;
  lat: number;
  lon: number;
  amslFt: number;
  aglFt: number | null;
  count: number;
  lighting: string | null;
}

export interface LegObstacle {
  type: string;
  // Obstacles grouped (sum of the SIA counts).
  count: number;
  // The highest of the group.
  ident: string;
  amslFt: number;
  aglFt: number | null;
  lat: number;
  lon: number;
  lighting: string | null;
  alongNm: number;
  offsetNm: number;
  // Planned altitude minus the top of the obstacle (negative: above).
  marginFt: number;
  status: CheckStatus;
}

export interface LegObstacles {
  obstacles: LegObstacle[];
  // Top of the highest obstacle in the corridor, whatever its margin.
  highestFt: number | null;
}

export function legObstacles(
  from: LatLon,
  to: LatLon,
  distanceNm: number,
  altitudeFt: number,
  obstacles: ObstacleRecord[],
): LegObstacles {
  const margin = OBSTACLE_CORRIDOR_NM / 60;
  const box = {
    minLat: Math.min(from.lat, to.lat) - margin,
    maxLat: Math.max(from.lat, to.lat) + margin,
    minLon:
      Math.min(from.lon, to.lon) -
      margin /
        Math.cos(
          (Math.max(Math.abs(from.lat), Math.abs(to.lat)) * Math.PI) / 180,
        ),
    maxLon:
      Math.max(from.lon, to.lon) +
      margin /
        Math.cos(
          (Math.max(Math.abs(from.lat), Math.abs(to.lat)) * Math.PI) / 180,
        ),
  };
  let highestFt: number | null = null;
  const close: (ObstacleRecord & { alongNm: number; offsetNm: number })[] = [];
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
      from,
      to,
      distanceNm,
    );
    if (offsetNm > OBSTACLE_CORRIDOR_NM) continue;
    highestFt = Math.max(highestFt ?? -Infinity, obstacle.amslFt);
    if (altitudeFt - obstacle.amslFt < OBSTACLE_MARGIN_FT)
      close.push({ ...obstacle, alongNm, offsetNm });
  }
  // Highest first, then grouped around it.
  close.sort((a, b) => b.amslFt - a.amslFt);
  const groups: LegObstacle[] = [];
  for (const obstacle of close) {
    const group = groups.find(
      (g) =>
        g.type === obstacle.type &&
        inverse(g, obstacle).distanceNm <= OBSTACLE_GROUP_NM,
    );
    if (group) {
      group.count += obstacle.count;
      continue;
    }
    groups.push({
      type: obstacle.type,
      count: obstacle.count,
      ident: obstacle.ident,
      amslFt: obstacle.amslFt,
      aglFt: obstacle.aglFt,
      lat: obstacle.lat,
      lon: obstacle.lon,
      lighting: obstacle.lighting,
      alongNm: Math.round(obstacle.alongNm * 10) / 10,
      offsetNm: Math.round(obstacle.offsetNm * 10) / 10,
      marginFt: Math.round(altitudeFt - obstacle.amslFt),
      status: 'WARNING',
    });
  }
  return {
    obstacles: groups.sort((a, b) => a.alongNm - b.alongNm),
    highestFt,
  };
}
