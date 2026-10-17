import { flightLevelToAltitudeFt } from './atmosphere';
import { LatLon, pointAlong } from './geodesy';
import {
  localProjection,
  Point,
  pointInPolygon,
  segmentIntersection,
} from './polygon';
import { CheckStatus, MessageRef } from './types';

// Which airspaces each leg crosses, laterally and vertically.
//
// Lateral: the leg and the outlines are projected on a local azimuthal
// equidistant plane centred on the middle of the leg; entry and exit are the
// exact crossings of the leg with the outline edges.
// Vertical: the aircraft altitude over [entry, exit] (from the computed
// profile) against floor and ceiling turned into altitudes AMSL:
//   AMSL as is; FL with the plan's QNH (FL x 100 - 145366.45 (1 - (QNH /
//   1013.25)^0.190284), ISA); SFC = 0; AGL (ASFC) cannot be decided without
//   a terrain model: a floor AGL is taken at the surface (prudent), a
//   ceiling AGL gives UNKNOWN_VERTICAL ("check the height above ground").

export type AltitudeRef = 'SFC' | 'AGL' | 'AMSL' | 'FL';
export type AirspaceType =
  | 'P'
  | 'R'
  | 'D'
  | 'CTR'
  | 'TMA'
  | 'CTA'
  | 'SIV'
  | 'RMZ'
  | 'TMZ'
  | 'TRA'
  | 'TSA'
  | 'PROTECTED'
  | 'GLIDING'
  | 'OTHER';
export type AirspaceRelation =
  | 'INSIDE'
  | 'NEAR_FLOOR'
  | 'NEAR_CEILING'
  | 'UNKNOWN_VERTICAL'
  | 'BELOW'
  | 'ABOVE';

export interface AltitudeLimit {
  ref: AltitudeRef;
  value: number;
}

export interface RadioFrequency {
  service: string;
  callsign: string | null;
  mhz: string;
}

export interface AirspaceRecord {
  id: string;
  name: string;
  type: AirspaceType;
  icaoClass: string | null;
  floor: AltitudeLimit;
  ceiling: AltitudeLimit;
  // Published activity text; null = unknown.
  activity: string | null;
  // Published schedule code (H24, HJ, HX, NOTAM...).
  scheduleCode?: string | null;
  frequencies: RadioFrequency[];
  remarks: string | null;
  // GeoJSON MultiPolygon coordinates: [polygon][ring][point][lon, lat].
  geometry: number[][][][];
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface AirspaceCrossing {
  airspace: AirspaceRecord;
  entryNm: number;
  exitNm: number;
  aircraftMinAltFt: number;
  aircraftMaxAltFt: number;
  relation: AirspaceRelation;
  status: CheckStatus;
  requirement: MessageRef;
  activityKnown: boolean;
}

export const altitudeLimitAmsl = (
  limit: AltitudeLimit,
  qnhHpa: number,
): number | null => {
  switch (limit.ref) {
    case 'SFC':
      return 0;
    case 'AMSL':
      return limit.value;
    case 'FL':
      return flightLevelToAltitudeFt(limit.value, qnhHpa);
    case 'AGL':
      return null;
  }
};

export const altitudeLimitLabel = (limit: AltitudeLimit): string => {
  switch (limit.ref) {
    case 'SFC':
      return 'SFC';
    case 'FL':
      return limit.value >= 999
        ? 'UNL'
        : `FL${String(limit.value).padStart(3, '0')}`;
    case 'AMSL':
      return `${limit.value} ft AMSL`;
    case 'AGL':
      return `${limit.value} ft ASFC`;
  }
};

export function verticalRelation(
  minAlt: number,
  maxAlt: number,
  airspace: Pick<AirspaceRecord, 'floor' | 'ceiling'>,
  qnhHpa: number,
  marginFt: number,
): AirspaceRelation {
  // A floor above the ground cannot be placed: taken at the surface.
  const floor = altitudeLimitAmsl(airspace.floor, qnhHpa) ?? 0;
  const ceiling = altitudeLimitAmsl(airspace.ceiling, qnhHpa);
  if (maxAlt < floor - marginFt) return 'BELOW';
  if (ceiling === null) {
    return 'UNKNOWN_VERTICAL';
  }
  if (minAlt > ceiling + marginFt) return 'ABOVE';
  const overlaps = maxAlt > floor && minAlt < ceiling;
  if (overlaps) {
    if (minAlt >= ceiling - marginFt) return 'NEAR_CEILING';
    if (maxAlt <= floor + marginFt) return 'NEAR_FLOOR';
    return 'INSIDE';
  }
  // Outside but within the margin of a limit.
  if (minAlt >= ceiling) return 'NEAR_CEILING';
  return 'NEAR_FLOOR';
}

const CONTROLLED = new Set<AirspaceType>(['CTR', 'TMA', 'CTA']);
const RESTRICTED_LIKE = new Set<AirspaceType>(['R', 'TRA', 'TSA']);

export function requirementOf(
  airspace: AirspaceRecord,
  relation: AirspaceRelation,
): { status: CheckStatus; requirement: MessageRef; activityKnown: boolean } {
  const activityKnown = (airspace.scheduleCode ?? '').toUpperCase() === 'H24';
  const activity = airspace.activity ?? '';
  const frequency = airspace.frequencies[0];
  const radio = frequency
    ? `${frequency.callsign ?? frequency.service} ${frequency.mhz}`
    : '';
  const passive = relation === 'ABOVE' || relation === 'BELOW';
  const near = relation === 'NEAR_FLOOR' || relation === 'NEAR_CEILING';
  const atLeastWarning = (status: CheckStatus): CheckStatus =>
    passive
      ? 'OK'
      : near || relation === 'UNKNOWN_VERTICAL'
        ? status === 'BLOCKING'
          ? 'BLOCKING'
          : 'WARNING'
        : status;

  if (airspace.type === 'P') {
    return {
      status: passive ? 'OK' : 'BLOCKING',
      requirement: { key: 'navplan.airspace.prohibited' },
      activityKnown: true,
    };
  }
  if (RESTRICTED_LIKE.has(airspace.type)) {
    return {
      status: passive ? 'OK' : 'WARNING',
      requirement: {
        key: 'navplan.airspace.restricted',
        params: { activity: activity || '?' },
      },
      activityKnown,
    };
  }
  if (airspace.type === 'D') {
    return {
      status: passive ? 'OK' : 'WARNING',
      requirement: {
        key: 'navplan.airspace.danger',
        params: { activity: activity || '?' },
      },
      activityKnown,
    };
  }
  // Without a published frequency the message says to read it on the chart.
  const withRadio = (key: string): MessageRef =>
    radio ? { key, params: { radio } } : { key: `${key}NoRadio` };
  if (airspace.type === 'RMZ') {
    return {
      status: atLeastWarning('WARNING'),
      requirement: withRadio('navplan.airspace.rmz'),
      activityKnown: true,
    };
  }
  if (airspace.type === 'TMZ') {
    return {
      status: atLeastWarning('WARNING'),
      requirement: { key: 'navplan.airspace.tmz' },
      activityKnown: true,
    };
  }
  if (airspace.type === 'SIV') {
    return {
      status: atLeastWarning('OK'),
      requirement: withRadio('navplan.airspace.siv'),
      activityKnown: true,
    };
  }
  if (airspace.type === 'PROTECTED') {
    return {
      status: atLeastWarning('WARNING'),
      requirement: {
        key: 'navplan.airspace.protected',
        params: { limit: altitudeLimitLabel(airspace.ceiling) },
      },
      activityKnown: true,
    };
  }
  const cls = (airspace.icaoClass ?? '').toUpperCase();
  if (cls === 'A') {
    return {
      status: passive ? 'OK' : 'BLOCKING',
      requirement: { key: 'navplan.airspace.classA' },
      activityKnown: true,
    };
  }
  if (cls === 'B' || cls === 'C' || cls === 'D') {
    return {
      status: atLeastWarning('WARNING'),
      requirement: withRadio('navplan.airspace.clearance'),
      activityKnown: true,
    };
  }
  if (cls === 'E') {
    return {
      status: atLeastWarning('OK'),
      requirement: { key: 'navplan.airspace.classE' },
      activityKnown: true,
    };
  }
  if (CONTROLLED.has(airspace.type)) {
    return {
      status: atLeastWarning('WARNING'),
      requirement: withRadio('navplan.airspace.clearance'),
      activityKnown: true,
    };
  }
  return {
    status: atLeastWarning('OK'),
    requirement: { key: 'navplan.airspace.other' },
    activityKnown,
  };
}

const bboxOverlaps = (
  airspace: AirspaceRecord,
  box: { minLat: number; maxLat: number; minLon: number; maxLon: number },
) =>
  !(
    airspace.maxLat < box.minLat ||
    airspace.minLat > box.maxLat ||
    airspace.maxLon < box.minLon ||
    airspace.minLon > box.maxLon
  );

// Intervals [entry, exit] in NM from the leg start where the leg is inside
// the outline.
export function lateralIntervals(
  from: LatLon,
  to: LatLon,
  distanceNm: number,
  geometry: number[][][][],
): [number, number][] {
  if (distanceNm <= 0) return [];
  const middle = pointAlong(from, to, distanceNm / 2);
  const projection = localProjection(middle);
  const p = projection.forward(from);
  const q = projection.forward(to);
  const intervals: [number, number][] = [];

  for (const polygon of geometry) {
    const rings = polygon.map((ring) =>
      ring.map(([lon, lat]) => projection.forward({ lat, lon })),
    );
    const ts = new Set<number>([0, 1]);
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const t = segmentIntersection(p, q, ring[i], ring[i + 1]);
        if (t !== null) ts.add(t);
      }
    }
    const sorted = [...ts].sort((a, b) => a - b);
    const insidePolygon = (point: Point) =>
      pointInPolygon(point, rings[0]) &&
      !rings
        .slice(1)
        .some((hole) => pointInPolygon(point, hole) && !onRing(point, hole));
    let open: number | null = null;
    for (let i = 0; i < sorted.length - 1; i++) {
      const t = (sorted[i] + sorted[i + 1]) / 2;
      const point: Point = [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
      const inside = insidePolygon(point);
      if (inside && open === null) open = sorted[i];
      if (!inside && open !== null) {
        intervals.push([open * distanceNm, sorted[i] * distanceNm]);
        open = null;
      }
    }
    if (open !== null) intervals.push([open * distanceNm, distanceNm]);
  }
  // Merge overlapping intervals of the parts of a multipolygon; a contact of
  // zero length is no crossing.
  intervals.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (last && interval[0] <= last[1] + 1e-9)
      last[1] = Math.max(last[1], interval[1]);
    else merged.push([...interval]);
  }
  return merged.filter(([a, b]) => b - a > 0.01);
}

const onRing = (point: Point, ring: Point[]) => {
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    const cross =
      (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
    if (Math.abs(cross) < 1e-12) return true;
  }
  return false;
};

export interface LegForCrossings {
  from: LatLon;
  to: LatLon;
  distanceNm: number;
  // Aircraft altitude AMSL at a distance from the leg start.
  altitudeAt: (distanceFromLegStartNm: number) => number;
}

export function legCrossings(
  leg: LegForCrossings,
  airspaces: AirspaceRecord[],
  qnhHpa: number,
  marginFt: number,
  options: { verticalUnknown?: boolean } = {},
): AirspaceCrossing[] {
  const lats = [leg.from.lat, leg.to.lat];
  const lons = [leg.from.lon, leg.to.lon];
  // A geodesic bulges a little poleward of the straight chord; 0.05 degree
  // covers legs of a few hundred NM.
  const box = {
    minLat: Math.min(...lats) - 0.05,
    maxLat: Math.max(...lats) + 0.05,
    minLon: Math.min(...lons) - 0.05,
    maxLon: Math.max(...lons) + 0.05,
  };
  const crossings: AirspaceCrossing[] = [];
  for (const airspace of airspaces) {
    if (!bboxOverlaps(airspace, box)) continue;
    for (const [entry, exit] of lateralIntervals(
      leg.from,
      leg.to,
      leg.distanceNm,
      airspace.geometry,
    )) {
      // The profile is piecewise linear: its extremes over the interval are
      // at the ends or at its vertices; sampling every 0.25 NM finds them.
      let minAlt = Infinity;
      let maxAlt = -Infinity;
      const steps = Math.max(1, Math.ceil((exit - entry) / 0.25));
      for (let i = 0; i <= steps; i++) {
        const alt = leg.altitudeAt(entry + ((exit - entry) * i) / steps);
        minAlt = Math.min(minAlt, alt);
        maxAlt = Math.max(maxAlt, alt);
      }
      const relation = options.verticalUnknown
        ? 'UNKNOWN_VERTICAL'
        : verticalRelation(minAlt, maxAlt, airspace, qnhHpa, marginFt);
      const { status, requirement, activityKnown } = requirementOf(
        airspace,
        relation,
      );
      crossings.push({
        airspace,
        entryNm: entry,
        exitNm: exit,
        aircraftMinAltFt: Math.round(minAlt),
        aircraftMaxAltFt: Math.round(maxAlt),
        relation,
        status: options.verticalUnknown && status === 'OK' ? 'WARNING' : status,
        requirement,
        activityKnown,
      });
    }
  }
  return crossings.sort((a, b) => a.entryNm - b.entryNm);
}

// Airspaces whose outline is not published (géométrie inconnue): never
// drawn, never "not crossed". The import keeps the point the SIA gives as
// their box, or UNLOCATED_BOX when they cannot be located.
export const UNLOCATED_BOX = {
  minLat: -90,
  maxLat: 90,
  minLon: -180,
  maxLon: 180,
};
// Distance from the published point within which such an area is listed
// in a plan: the cores of the metropolitan national parks reach 25 NM from
// their published point (Mercantour, AIRAC 2310).
export const UNVERIFIED_AIRSPACE_NEAR_NM = 30;

export const hasOutline = (airspace: Pick<AirspaceRecord, 'geometry'>) =>
  airspace.geometry.length > 0;

export const referencePointOf = (
  airspace: Pick<
    AirspaceRecord,
    'geometry' | 'minLat' | 'maxLat' | 'minLon' | 'maxLon'
  >,
): LatLon | null =>
  !hasOutline(airspace) &&
  airspace.minLat === airspace.maxLat &&
  airspace.minLon === airspace.maxLon
    ? { lat: airspace.minLat, lon: airspace.maxLon }
    : null;

export interface UnverifiedAirspace {
  airspace: AirspaceRecord;
  // Distance from the route to the published point; null = not located.
  distanceNm: number | null;
}

const distanceToLegNm = (point: LatLon, from: LatLon, to: LatLon) => {
  const projection = localProjection(point);
  const a = projection.forward(from);
  const b = projection.forward(to);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  const t =
    length2 === 0
      ? 0
      : Math.min(1, Math.max(0, -(a[0] * dx + a[1] * dy) / length2));
  return Math.hypot(a[0] + t * dx, a[1] + t * dy);
};

// The areas without an outline that the route may meet: near their point
// (or anywhere when they cannot be located), unless the whole flight is
// known to stay below their floor or above their ceiling.
export function unverifiedAirspaces(
  legs: { from: LatLon; to: LatLon }[],
  airspaces: AirspaceRecord[],
  flight: { minAltFt: number; maxAltFt: number } | null,
  qnhHpa: number,
  marginFt: number,
): UnverifiedAirspace[] {
  const found: UnverifiedAirspace[] = [];
  for (const airspace of airspaces) {
    if (hasOutline(airspace)) continue;
    if (flight) {
      const relation = verticalRelation(
        flight.minAltFt,
        flight.maxAltFt,
        airspace,
        qnhHpa,
        marginFt,
      );
      if (relation === 'BELOW' || relation === 'ABOVE') continue;
    }
    const point = referencePointOf(airspace);
    if (!point) {
      found.push({ airspace, distanceNm: null });
      continue;
    }
    const distanceNm = Math.min(
      ...legs.map((leg) => distanceToLegNm(point, leg.from, leg.to)),
    );
    if (distanceNm <= UNVERIFIED_AIRSPACE_NEAR_NM)
      found.push({ airspace, distanceNm });
  }
  return found.sort(
    (a, b) =>
      (a.distanceNm ?? Infinity) - (b.distanceNm ?? Infinity) ||
      a.airspace.name.localeCompare(b.airspace.name),
  );
}
