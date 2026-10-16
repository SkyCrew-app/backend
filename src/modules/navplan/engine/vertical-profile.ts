import {
  isaTemperatureC,
  pressureAltitudeFt,
  trueAirspeedKt,
} from './atmosphere';
import { casFromIas, climbBetween, cruiseAt } from './performance';
import { PerformanceData } from './types';
import { solveWindTriangle, WindTriangleError } from './wind-triangle';

// The vertical profile of the whole route, and how it cuts each leg into
// climb, cruise and descent segments.
//
// Climb: from the end altitude of the previous leg (the departure field
// elevation at first) towards the leg altitude, by the climb data of the
// aircraft, with the wind of each 1000 ft slice; a climb not finished at
// the end of a leg goes on along the next one.
// Descent: at a constant rate and descent IAS, computed backwards from the
// point where the lower altitude must be reached: the waypoint where a
// lower leg starts, and the destination overhead at circuit height.
// The profile is the lower of the two.

export type Phase = 'CLIMB' | 'CRUISE' | 'DESCENT';

export interface WindSample {
  fromDeg: number;
  speedKt: number;
  temperatureC: number | null;
}

export interface ProfileLeg {
  distanceNm: number;
  trueCourseDeg: number;
  altitudeFt: number;
  cruiseSetting: string;
  // Wind and temperature on this leg at an altitude (AMSL).
  windAt: (altitudeFt: number) => WindSample;
}

export interface ProfileInput {
  legs: ProfileLeg[];
  startAltitudeFt: number;
  endAltitudeFt: number;
  qnhHpa: number;
  performance: PerformanceData;
  descentRateFpm: number;
}

export interface PhaseSegment {
  phase: Phase;
  fromNm: number;
  toNm: number;
  startAltFt: number;
  endAltFt: number;
  tasKt: number;
  gsKt: number;
  timeMin: number;
  fuelL: number;
}

export interface ProfilePoint {
  distanceNm: number;
  altitudeFt: number;
  label: string | null;
}

export interface ProfileIssue {
  code: string;
  params: Record<string, string | number>;
  legIndex: number;
}

export interface ProfileResult {
  segmentsByLeg: PhaseSegment[][];
  points: ProfilePoint[];
  issues: ProfileIssue[];
  // Altitude AMSL at a distance from the departure.
  altitudeAt: (distanceNm: number) => number;
}

type Vertex = { x: number; alt: number };

const SLICE_FT = 1000;
const EPS_NM = 1e-6;

const temperatureOf = (sample: WindSample, pressureAlt: number) =>
  sample.temperatureC ?? isaTemperatureC(pressureAlt);

export function buildProfile(input: ProfileInput): ProfileResult {
  const { legs, performance, qnhHpa } = input;
  const issues: ProfileIssue[] = [];
  const starts: number[] = [];
  let total = 0;
  for (const leg of legs) {
    starts.push(total);
    total += leg.distanceNm;
  }
  const zp = (alt: number) => pressureAltitudeFt(alt, qnhHpa);
  const calibration = performance.calibration ?? [];

  const groundSpeed = (
    leg: ProfileLeg,
    legIndex: number,
    tas: number,
    alt: number,
  ) => {
    const wind = leg.windAt(alt);
    try {
      return solveWindTriangle(
        leg.trueCourseDeg,
        tas,
        wind.fromDeg,
        wind.speedKt,
      ).groundSpeedKt;
    } catch (error) {
      if (error instanceof WindTriangleError) {
        issues.push({
          code: error.code,
          params: { leg: legIndex + 1 },
          legIndex,
        });
        return tas;
      }
      throw error;
    }
  };

  const climbOptions = (leg: ProfileLeg) => ({
    serviceCeilingFt: performance.serviceCeilingFt,
    calibration,
    temperatureAt: (z: number) => {
      // z is a pressure altitude; the forecast is looked up near it.
      const sample = leg.windAt(z - (zp(0) - 0));
      return sample.temperatureC ?? isaTemperatureC(z);
    },
  });

  // Forward pass: what the aircraft can reach climbing.
  const forward: Vertex[] = [{ x: 0, alt: input.startAltitudeFt }];
  let altitude = input.startAltitudeFt;
  legs.forEach((leg, index) => {
    const x0 = starts[index];
    const x1 = x0 + leg.distanceNm;
    let x = x0;
    if (altitude > leg.altitudeFt) {
      altitude = leg.altitudeFt;
      forward.push({ x, alt: altitude });
    }
    while (altitude < leg.altitudeFt - 1e-6 && x < x1 - EPS_NM) {
      const sliceTop = Math.min(
        leg.altitudeFt,
        (Math.floor(altitude / SLICE_FT) + 1) * SLICE_FT,
      );
      const climb = climbBetween(
        performance.climb,
        zp(altitude),
        zp(sliceTop),
        climbOptions(leg),
      );
      const gs = groundSpeed(
        leg,
        index,
        climb.tasKt,
        (altitude + sliceTop) / 2,
      );
      const ground = (climb.timeMin / 60) * gs;
      if (x + ground <= x1 + EPS_NM) {
        x += ground;
        altitude = sliceTop;
        forward.push({ x, alt: altitude });
      } else {
        const reached = altitude + ((sliceTop - altitude) * (x1 - x)) / ground;
        x = x1;
        altitude = reached;
        forward.push({ x, alt: altitude });
      }
    }
    if (x < x1) forward.push({ x: x1, alt: altitude });
  });

  // Backward pass: the highest the aircraft may be to make its descents.
  const backward: Vertex[] = [];
  let ceiling = input.endAltitudeFt;
  for (let index = legs.length - 1; index >= 0; index--) {
    const leg = legs[index];
    const x0 = starts[index];
    const x1 = x0 + leg.distanceNm;
    const constraint =
      index === legs.length - 1
        ? input.endAltitudeFt
        : legs[index + 1].altitudeFt;
    ceiling = Math.min(ceiling, constraint);
    backward.push({ x: x1, alt: ceiling });
    const midAlt = (ceiling + leg.altitudeFt) / 2;
    const tas = trueAirspeedKt(
      casFromIas(calibration, performance.descent.iasKt),
      zp(midAlt),
      temperatureOf(leg.windAt(midAlt), zp(midAlt)),
    );
    const gs = groundSpeed(leg, index, tas, midAlt);
    const feetPerNm = (input.descentRateFpm * 60) / gs;
    ceiling += feetPerNm * leg.distanceNm;
    backward.push({ x: x0, alt: ceiling });
  }
  backward.reverse();

  const points = lowerEnvelope(forward, backward);
  const altitudeAt = (distance: number) => evaluate(points, distance);

  // Segments per leg.
  const segmentsByLeg: PhaseSegment[][] = legs.map((leg, index) => {
    const x0 = starts[index];
    const x1 = x0 + leg.distanceNm;
    const xs = [
      x0,
      ...points
        .map((p) => p.x)
        .filter((x) => x > x0 + EPS_NM && x < x1 - EPS_NM),
      x1,
    ];
    const pieces: { phase: Phase; a: Vertex; b: Vertex }[] = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const a = { x: xs[i], alt: altitudeAt(xs[i]) };
      const b = { x: xs[i + 1], alt: altitudeAt(xs[i + 1]) };
      if (b.x - a.x < EPS_NM) continue;
      const slope = b.alt - a.alt;
      const phase: Phase =
        slope > 0.5 ? 'CLIMB' : slope < -0.5 ? 'DESCENT' : 'CRUISE';
      const last = pieces[pieces.length - 1];
      if (last && last.phase === phase) {
        last.b = b;
      } else {
        pieces.push({ phase, a, b });
      }
    }
    if (pieces.length === 0) {
      pieces.push({
        phase: 'CRUISE',
        a: { x: x0, alt: altitudeAt(x0) },
        b: { x: x1, alt: altitudeAt(x1) },
      });
    }
    return pieces.map(({ phase, a, b }) => {
      const distance = b.x - a.x;
      const midAlt = (a.alt + b.alt) / 2;
      const midZp = zp(midAlt);
      const sample = leg.windAt(midAlt);
      if (phase === 'CLIMB') {
        const climb = climbBetween(
          performance.climb,
          zp(a.alt),
          zp(b.alt),
          climbOptions(leg),
        );
        return {
          phase,
          fromNm: a.x - x0,
          toNm: b.x - x0,
          startAltFt: a.alt,
          endAltFt: b.alt,
          tasKt: climb.tasKt,
          gsKt: climb.timeMin > 0 ? (distance / climb.timeMin) * 60 : 0,
          timeMin: climb.timeMin,
          fuelL: climb.fuelL,
        };
      }
      if (phase === 'DESCENT') {
        const timeMin = (a.alt - b.alt) / input.descentRateFpm;
        const tas = trueAirspeedKt(
          casFromIas(calibration, performance.descent.iasKt),
          midZp,
          temperatureOf(sample, midZp),
        );
        return {
          phase,
          fromNm: a.x - x0,
          toNm: b.x - x0,
          startAltFt: a.alt,
          endAltFt: b.alt,
          tasKt: tas,
          gsKt: timeMin > 0 ? (distance / timeMin) * 60 : 0,
          timeMin,
          fuelL: (timeMin / 60) * performance.descent.fuelFlowLph,
        };
      }
      const isaDeviation =
        temperatureOf(sample, midZp) - isaTemperatureC(midZp);
      const cruise = cruiseAt(
        performance.cruise,
        leg.cruiseSetting,
        midZp,
        isaDeviation,
      );
      if (cruise.temperatureIgnored) {
        issues.push({
          code: 'CRUISE_TEMPERATURE_IGNORED',
          params: { leg: index + 1, deviation: Math.round(isaDeviation) },
          legIndex: index,
        });
      }
      const gs = groundSpeed(leg, index, cruise.tasKt, midAlt);
      const timeMin = (distance / gs) * 60;
      return {
        phase,
        fromNm: a.x - x0,
        toNm: b.x - x0,
        startAltFt: a.alt,
        endAltFt: b.alt,
        tasKt: cruise.tasKt,
        gsKt: gs,
        timeMin,
        fuelL: (timeMin / 60) * cruise.fuelFlowLph,
      };
    });
  });

  // Profile points with TOC/TOD markers where a climb or a descent meets a
  // level segment.
  const profile: ProfilePoint[] = [];
  const flat = segmentsByLeg.flatMap((segments, index) =>
    segments.map((segment) => ({ ...segment, offset: starts[index] })),
  );
  flat.forEach((segment, i) => {
    if (i === 0) {
      profile.push({
        distanceNm: 0,
        altitudeFt: segment.startAltFt,
        label: null,
      });
    }
    const next = flat[i + 1];
    let label: string | null = null;
    if (segment.phase === 'CLIMB' && next && next.phase !== 'CLIMB')
      label = 'TOC';
    if (segment.phase !== 'DESCENT' && next && next.phase === 'DESCENT')
      label = 'TOD';
    profile.push({
      distanceNm: segment.offset + segment.toNm,
      altitudeFt: segment.endAltFt,
      label,
    });
  });

  return { segmentsByLeg, points: profile, issues, altitudeAt };
}

function evaluate(vertices: Vertex[], x: number): number {
  if (vertices.length === 0) return 0;
  if (x <= vertices[0].x) return vertices[0].alt;
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i];
    const b = vertices[i + 1];
    if (x >= a.x && x <= b.x) {
      if (b.x - a.x < 1e-12) return Math.min(a.alt, b.alt);
      return a.alt + ((b.alt - a.alt) * (x - a.x)) / (b.x - a.x);
    }
  }
  return vertices[vertices.length - 1].alt;
}

// Value just after (side +1) or just before (side -1) x, for polylines with
// vertical steps (two vertices at the same x).
function evaluateSide(vertices: Vertex[], x: number, side: 1 | -1): number {
  if (side === 1) {
    for (let i = vertices.length - 1; i >= 0; i--) {
      if (vertices[i].x <= x + 1e-12) {
        const a = vertices[i];
        const b = vertices[i + 1];
        if (!b) return a.alt;
        if (Math.abs(a.x - x) < 1e-12) return a.alt;
        return a.alt + ((b.alt - a.alt) * (x - a.x)) / (b.x - a.x);
      }
    }
    return vertices[0].alt;
  }
  for (let i = 0; i < vertices.length; i++) {
    if (vertices[i].x >= x - 1e-12) {
      const b = vertices[i];
      const a = vertices[i - 1];
      if (!a) return b.alt;
      if (Math.abs(b.x - x) < 1e-12) return b.alt;
      return a.alt + ((b.alt - a.alt) * (x - a.x)) / (b.x - a.x);
    }
  }
  return vertices[vertices.length - 1].alt;
}

function lowerEnvelope(f: Vertex[], g: Vertex[]): Vertex[] {
  const xs = [...new Set([...f, ...g].map((v) => v.x))].sort((a, b) => a - b);
  const result: Vertex[] = [];
  const push = (x: number, alt: number) => {
    const last = result[result.length - 1];
    if (last && Math.abs(last.x - x) < 1e-9 && Math.abs(last.alt - alt) < 1e-6)
      return;
    result.push({ x, alt });
  };
  for (let i = 0; i < xs.length - 1; i++) {
    const xa = xs[i];
    const xb = xs[i + 1];
    const fa = evaluateSide(f, xa, 1);
    const fb = evaluateSide(f, xb, -1);
    const ga = evaluateSide(g, xa, 1);
    const gb = evaluateSide(g, xb, -1);
    push(xa, Math.min(fa, ga));
    const da = fa - ga;
    const db = fb - gb;
    if (da * db < 0) {
      const t = da / (da - db);
      const x = xa + t * (xb - xa);
      push(x, fa + t * (fb - fa));
    }
    push(xb, Math.min(fb, gb));
  }
  if (xs.length === 1) push(xs[0], Math.min(f[0].alt, g[0]?.alt ?? f[0].alt));
  return result;
}
