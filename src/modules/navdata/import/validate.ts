import { inverse } from '../../navplan/engine/geodesy';
import {
  Point,
  segmentIntersection,
  signedArea,
} from '../../navplan/engine/polygon';
import { isActivityType } from '../../navplan/engine/airspace-intersection';
import { ImportReport, NavdataBundle } from './bundle-types';

// What a cycle must pass before it replaces the one in force. A failing
// cycle is kept as REJECTED and the active one stays.

export const REFERENCE_AERODROMES = [
  'LFPG',
  'LFPO',
  'LFPN',
  'LFBO',
  'LFMN',
  'LFRB',
];
export const COUNT_TOLERANCE = 0.1;
export const POSITION_TOLERANCE_M = 100;
const REQUIRED_TYPES = ['CTR', 'TMA', 'P', 'R'];
// Share of airspaces without an outline above which a cycle is rejected
// (unless forced). Protected areas are left out of the share: the SIA
// publishes most of them as a single point (111 of 137 in AIRAC 2310),
// they are still flagged one by one in the report and in the plans.
export const MAX_UNKNOWN_OUTLINE_SHARE = 0.05;
const UNKNOWN_OUTLINE_SHARE_EXCLUDES = new Set(['PROTECTED']);

export interface PreviousCycleSummary {
  airspaceCountByType: Record<string, number>;
  aerodromes: Record<string, { lat: number; lon: number }>;
}

// No two non-adjacent edges cross; edges are bucketed on a grid so that
// outlines of a few thousand points are checked quickly.
export function isSimpleRing(ring: number[][]): boolean {
  const points: Point[] = ring.map(([x, y]) => [x, y]);
  if (points.length > 1) {
    const [first, last] = [points[0], points[points.length - 1]];
    if (first[0] === last[0] && first[1] === last[1]) points.pop();
  }
  const n = points.length;
  if (n < 3 || Math.abs(signedArea(points)) <= 0) return false;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const size =
    Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) /
      Math.max(1, Math.sqrt(n)) || 1;
  const cells = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const x0 = Math.floor((Math.min(a[0], b[0]) - minX) / size);
    const x1 = Math.floor((Math.max(a[0], b[0]) - minX) / size);
    const y0 = Math.floor((Math.min(a[1], b[1]) - minY) / size);
    const y1 = Math.floor((Math.max(a[1], b[1]) - minY) / size);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const key = `${x}:${y}`;
        const list = cells.get(key) ?? [];
        list.push(i);
        cells.set(key, list);
      }
    }
  }
  const checked = new Set<string>();
  for (const edges of cells.values()) {
    for (let a = 0; a < edges.length; a++) {
      for (let b = a + 1; b < edges.length; b++) {
        const i = Math.min(edges[a], edges[b]);
        const j = Math.max(edges[a], edges[b]);
        if (j - i === 1 || (i === 0 && j === n - 1)) continue;
        const key = `${i}:${j}`;
        if (checked.has(key)) continue;
        checked.add(key);
        if (
          segmentIntersection(
            points[i],
            points[(i + 1) % n],
            points[j],
            points[(j + 1) % n],
          ) !== null
        ) {
          return false;
        }
      }
    }
  }
  return true;
}

export function summarize(bundle: NavdataBundle): PreviousCycleSummary {
  const airspaceCountByType: Record<string, number> = {};
  for (const airspace of bundle.airspaces) {
    airspaceCountByType[airspace.type] =
      (airspaceCountByType[airspace.type] ?? 0) + 1;
  }
  const aerodromes: PreviousCycleSummary['aerodromes'] = {};
  for (const point of bundle.points) {
    if (
      point.type === 'AERODROME' &&
      REFERENCE_AERODROMES.includes(point.ident)
    ) {
      aerodromes[point.ident] = { lat: point.lat, lon: point.lon };
    }
  }
  return { airspaceCountByType, aerodromes };
}

export function validateBundle(
  bundle: NavdataBundle,
  previous: PreviousCycleSummary | null,
  report: ImportReport,
): boolean {
  const errors = report.errors;
  const hasSia = !!bundle.sources.sia;
  const current = summarize(bundle);

  for (const ident of REFERENCE_AERODROMES) {
    const point = current.aerodromes[ident];
    if (!point) {
      errors.push(`Reference aerodrome ${ident} missing`);
      continue;
    }
    const before = previous?.aerodromes[ident];
    if (before) {
      const moved = inverse(before, point).distanceM;
      if (moved > POSITION_TOLERANCE_M) {
        errors.push(
          `${ident} moved by ${Math.round(moved)} m since the previous cycle`,
        );
      }
    }
  }

  if (hasSia) {
    for (const type of REQUIRED_TYPES) {
      if (!current.airspaceCountByType[type])
        errors.push(`No airspace of type ${type}`);
    }
    for (const airspace of bundle.airspaces) {
      for (const polygon of airspace.geometry) {
        const ring = polygon[0];
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (ring.length < 4 || first[0] !== last[0] || first[1] !== last[1]) {
          errors.push(`${airspace.name}: outline not closed`);
        } else if (!isSimpleRing(ring)) {
          errors.push(
            `${airspace.name}: outline crosses itself or has no area`,
          );
        }
      }
    }
    // Activities (parachuting, model aircraft...) are published as a point:
    // no outline is expected.
    const counted = bundle.airspaces.filter(
      (a) =>
        !UNKNOWN_OUTLINE_SHARE_EXCLUDES.has(a.type) && !isActivityType(a.type),
    );
    const unknown = counted.filter((a) => a.geometry.length === 0).length;
    if (
      counted.length > 0 &&
      unknown / counted.length > MAX_UNKNOWN_OUTLINE_SHARE
    ) {
      errors.push(
        `${unknown} of ${counted.length} airspaces (protected areas left out) have no outline (géométrie inconnue), more than ${MAX_UNKNOWN_OUTLINE_SHARE * 100} %`,
      );
    }
    const previousCounts = previous?.airspaceCountByType ?? {};
    if (Object.keys(previousCounts).length > 0) {
      for (const [type, count] of Object.entries(previousCounts)) {
        const now = current.airspaceCountByType[type] ?? 0;
        if (Math.abs(now - count) > Math.max(1, count * COUNT_TOLERANCE)) {
          errors.push(
            `${type}: ${now} airspaces, ${count} in the previous cycle (more than ±10 %)`,
          );
        }
      }
    }
  }
  report.counts.points = bundle.points.length;
  report.counts.airspaces = bundle.airspaces.length;
  if (bundle.obstacles) report.counts.obstacles = bundle.obstacles.length;
  return errors.length === 0;
}
