import {
  onSegment,
  Point,
  pointInPolygon,
  segmentIntersection,
} from './polygon';
import {
  CheckStatus,
  Envelope,
  EnvelopeCategory,
  MassBalanceData,
  MessageRef,
} from './types';

// Mass and balance: m = Σ mᵢ, M = Σ mᵢ·bᵢ, CG = M / m (fuel: litres ×
// density). Checked at take-off and at landing, and along the straight
// line between them (the CG moves linearly in mass/moment as fuel burns).

export interface LoadLine {
  stationId: string;
  label: string;
  massKg: number;
  armM: number;
  momentKgm: number;
}

export interface MassBalanceState {
  massKg: number;
  momentKgm: number;
  cgM: number;
  withinEnvelope: boolean;
  // Signed distances to the envelope (negative outside): in mass at the
  // same CG, and in CG (mm) at the same mass. Mass also limited by MTOW
  // (take-off) or MLW (landing).
  marginKg: number;
  marginCgMm: number;
}

export interface MassBalanceResult {
  lines: LoadLine[];
  takeoff: MassBalanceState;
  landing: MassBalanceState;
  zeroFuel: MassBalanceState;
  envelope: Envelope;
  status: CheckStatus;
  messages: MessageRef[];
}

export interface MassBalanceInput {
  data: MassBalanceData;
  loads: { stationId: string; massKg: number | null }[];
  // Fuel by tank at take-off and at landing, litres.
  fuelTakeoffL: Record<string, number>;
  fuelLandingL: Record<string, number>;
  fuelArmByTank: Record<string, number>;
  fuelLabelByTank: Record<string, string>;
  densityKgPerL: number;
  category: EnvelopeCategory;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

const EMPTY_STATE: MassBalanceState = {
  massKg: 0,
  momentKgm: 0,
  cgM: 0,
  withinEnvelope: false,
  marginKg: 0,
  marginCgMm: 0,
};

export const emptyMassBalanceResult = (
  category: EnvelopeCategory,
  messages: MessageRef[],
): MassBalanceResult => ({
  lines: [],
  takeoff: EMPTY_STATE,
  landing: EMPTY_STATE,
  zeroFuel: EMPTY_STATE,
  envelope: { category, points: [] },
  status: 'BLOCKING',
  messages,
});

const ring = (envelope: Envelope): Point[] =>
  envelope.points.map((p) => [p.armM, p.massKg]);

// Crossings of the envelope outline by the horizontal (mass = m) or vertical
// (arm = cg) line through the point.
function crossings(points: Point[], axis: 'h' | 'v', value: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const [fixedA, fixedB, freeA, freeB] =
      axis === 'h' ? [a[1], b[1], a[0], b[0]] : [a[0], b[0], a[1], b[1]];
    if (value < Math.min(fixedA, fixedB) || value > Math.max(fixedA, fixedB))
      continue;
    if (fixedA === fixedB) {
      values.push(freeA, freeB);
    } else {
      values.push(
        freeA + ((value - fixedA) * (freeB - freeA)) / (fixedB - fixedA),
      );
    }
  }
  return values;
}

function marginTo(
  points: Point[],
  axis: 'h' | 'v',
  fixed: number,
  free: number,
  inside: boolean,
): number {
  const values = crossings(points, axis, fixed);
  if (values.length === 0) return -Infinity;
  const distances = values.map((v) => Math.abs(v - free));
  const nearest = Math.min(...distances);
  return inside ? nearest : -nearest;
}

export function stateOf(
  massKg: number,
  momentKgm: number,
  envelope: Envelope,
  massLimit: number | null,
): MassBalanceState {
  const cg = massKg > 0 ? momentKgm / massKg : 0;
  const points = ring(envelope);
  const inside = pointInPolygon([cg, massKg], points);
  let marginKg = marginTo(points, 'v', cg, massKg, inside);
  if (massLimit != null) marginKg = Math.min(marginKg, massLimit - massKg);
  const marginCg = marginTo(points, 'h', massKg, cg, inside);
  return {
    massKg,
    momentKgm,
    cgM: cg,
    withinEnvelope: inside,
    marginKg: Number.isFinite(marginKg) ? marginKg : -massKg,
    marginCgMm: Number.isFinite(marginCg) ? marginCg * 1000 : -1000,
  };
}

// The segment take-off -> landing stays inside: both ends inside and no
// edge of the outline crossed in between (edges merely touched are fine).
export function segmentInside(a: Point, b: Point, points: Point[]): boolean {
  if (!pointInPolygon(a, points) || !pointInPolygon(b, points)) return false;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const t = segmentIntersection(a, b, p, q);
    if (t === null || t <= 1e-9 || t >= 1 - 1e-9) continue;
    const x: Point = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    if (onSegment(x, p, q)) {
      const before: Point = [
        x[0] - (b[0] - a[0]) * 1e-6,
        x[1] - (b[1] - a[1]) * 1e-6,
      ];
      const after: Point = [
        x[0] + (b[0] - a[0]) * 1e-6,
        x[1] + (b[1] - a[1]) * 1e-6,
      ];
      if (!pointInPolygon(before, points) || !pointInPolygon(after, points))
        return false;
    }
  }
  return true;
}

function envelopeMessage(
  state: MassBalanceState,
  points: Point[],
  moment: 'takeoff' | 'landing',
): MessageRef | null {
  if (state.withinEnvelope) return null;
  const arms = crossings(points, 'h', state.massKg);
  const allArms = points.map((p) => p[0]);
  const minArm = arms.length ? Math.min(...arms) : Math.min(...allArms);
  const maxArm = arms.length ? Math.max(...arms) : Math.max(...allArms);
  const params = {
    moment,
    cg: state.cgM.toFixed(3),
    mass: round1(state.massKg),
  };
  if (state.cgM > maxArm)
    return {
      key: 'navplan.mb.cgAft',
      params: { ...params, limit: maxArm.toFixed(3) },
    };
  if (state.cgM < minArm)
    return {
      key: 'navplan.mb.cgForward',
      params: { ...params, limit: minArm.toFixed(3) },
    };
  return { key: 'navplan.mb.outOfEnvelope', params };
}

export function computeMassBalance(input: MassBalanceInput): MassBalanceResult {
  const { data } = input;
  const messages: MessageRef[] = [];
  const envelope =
    data.envelopes.find((e) => e.category === input.category) ?? null;
  if (!envelope || envelope.points.length < 3) {
    return emptyMassBalanceResult(input.category, [
      { key: 'navplan.mb.noEnvelope', params: { category: input.category } },
    ]);
  }
  if (data.emptyMassKg == null || data.emptyArmM == null) {
    return emptyMassBalanceResult(input.category, [
      { key: 'navplan.mb.noWeighing' },
    ]);
  }

  const lines: LoadLine[] = [
    {
      stationId: 'EMPTY',
      label: 'EMPTY',
      massKg: data.emptyMassKg,
      armM: data.emptyArmM,
      momentKgm: data.emptyMassKg * data.emptyArmM,
    },
  ];
  const massByStation = new Map<string, number>();
  for (const load of input.loads) {
    const station = data.stations.find((s) => s.id === load.stationId);
    if (!station) {
      messages.push({
        key: 'navplan.mb.unknownStation',
        params: { station: load.stationId },
      });
      continue;
    }
    // Fuel is loaded by tank, never as a station mass.
    if (station.kind === 'FUEL') continue;
    const mass = Number(load.massKg) || 0;
    if (mass < 0) {
      messages.push({
        key: 'navplan.mb.negativeMass',
        params: { station: station.label },
      });
      continue;
    }
    if (mass === 0) continue;
    massByStation.set(station.id, (massByStation.get(station.id) ?? 0) + mass);
    lines.push({
      stationId: station.id,
      label: station.label,
      massKg: mass,
      armM: station.armM,
      momentKgm: mass * station.armM,
    });
  }
  for (const station of data.stations) {
    const mass = massByStation.get(station.id) ?? 0;
    if (station.maxKg != null && mass > station.maxKg + 1e-9) {
      messages.push({
        key: 'navplan.mb.stationLimit',
        params: {
          station: station.label,
          mass: round1(mass),
          max: round1(station.maxKg),
        },
      });
    }
  }
  for (const limit of data.combinedLimits) {
    const mass = limit.stationIds.reduce(
      (sum, id) => sum + (massByStation.get(id) ?? 0),
      0,
    );
    if (mass > limit.maxKg + 1e-9) {
      messages.push({
        key: 'navplan.mb.stationLimit',
        params: {
          station: limit.label,
          mass: round1(mass),
          max: round1(limit.maxKg),
        },
      });
    }
  }

  const zeroFuelMass = lines.reduce((sum, l) => sum + l.massKg, 0);
  const zeroFuelMoment = lines.reduce((sum, l) => sum + l.momentKgm, 0);

  let fuelTakeoffMass = 0;
  let fuelTakeoffMoment = 0;
  let fuelLandingMass = 0;
  let fuelLandingMoment = 0;
  for (const [tankId, litres] of Object.entries(input.fuelTakeoffL)) {
    if (!(litres > 0)) continue;
    const arm = input.fuelArmByTank[tankId] ?? 0;
    const mass = litres * input.densityKgPerL;
    fuelTakeoffMass += mass;
    fuelTakeoffMoment += mass * arm;
    lines.push({
      stationId: `FUEL:${tankId}`,
      label: input.fuelLabelByTank[tankId] ?? tankId,
      massKg: mass,
      armM: arm,
      momentKgm: mass * arm,
    });
  }
  for (const [tankId, litres] of Object.entries(input.fuelLandingL)) {
    if (!(litres > 0)) continue;
    const arm = input.fuelArmByTank[tankId] ?? 0;
    fuelLandingMass += litres * input.densityKgPerL;
    fuelLandingMoment += litres * input.densityKgPerL * arm;
  }

  const takeoff = stateOf(
    zeroFuelMass + fuelTakeoffMass,
    zeroFuelMoment + fuelTakeoffMoment,
    envelope,
    data.mtowKg,
  );
  const landing = stateOf(
    zeroFuelMass + fuelLandingMass,
    zeroFuelMoment + fuelLandingMoment,
    envelope,
    data.mlwKg ?? data.mtowKg,
  );
  const zeroFuel = stateOf(
    zeroFuelMass,
    zeroFuelMoment,
    envelope,
    data.mzfwKg ?? null,
  );

  if (data.mtowKg != null && takeoff.massKg > data.mtowKg + 1e-9) {
    messages.push({
      key: 'navplan.mb.aboveMtow',
      params: { mass: round1(takeoff.massKg), max: round1(data.mtowKg) },
    });
  }
  const mlw = data.mlwKg ?? data.mtowKg;
  if (mlw != null && landing.massKg > mlw + 1e-9) {
    messages.push({
      key: 'navplan.mb.aboveMlw',
      params: { mass: round1(landing.massKg), max: round1(mlw) },
    });
  }
  if (data.mzfwKg != null && zeroFuel.massKg > data.mzfwKg + 1e-9) {
    messages.push({
      key: 'navplan.mb.aboveMzfw',
      params: { mass: round1(zeroFuel.massKg), max: round1(data.mzfwKg) },
    });
  }
  const points = ring(envelope);
  const takeoffMessage = envelopeMessage(takeoff, points, 'takeoff');
  if (takeoffMessage) messages.push(takeoffMessage);
  const landingMessage = envelopeMessage(landing, points, 'landing');
  if (landingMessage && landingMessage.key !== takeoffMessage?.key) {
    messages.push(landingMessage);
  }
  if (
    takeoff.withinEnvelope &&
    landing.withinEnvelope &&
    !segmentInside(
      [takeoff.cgM, takeoff.massKg],
      [landing.cgM, landing.massKg],
      points,
    )
  ) {
    messages.push({ key: 'navplan.mb.pathLeavesEnvelope' });
  }

  return {
    lines,
    takeoff,
    landing,
    zeroFuel,
    envelope,
    status: messages.length > 0 ? 'BLOCKING' : 'OK',
    messages,
  };
}

// Fuel left in each tank after `burnL` litres, by the declared order or in
// proportion to the contents.
export function burnFuel(
  byTank: Record<string, number>,
  burnL: number,
  burnOrder: string[],
): Record<string, number> {
  const result = { ...byTank };
  let remaining = Math.max(0, burnL);
  const total = Object.values(result).reduce((s, v) => s + Math.max(0, v), 0);
  if (burnOrder.length === 0) {
    if (total <= 0) return result;
    const factor = Math.max(0, total - remaining) / total;
    for (const id of Object.keys(result))
      result[id] = Math.max(0, result[id]) * factor;
    return result;
  }
  const order = [
    ...burnOrder,
    ...Object.keys(result).filter((id) => !burnOrder.includes(id)),
  ];
  for (const id of order) {
    if (remaining <= 0) break;
    const available = Math.max(0, result[id] ?? 0);
    const used = Math.min(available, remaining);
    result[id] = available - used;
    remaining -= used;
  }
  return result;
}
