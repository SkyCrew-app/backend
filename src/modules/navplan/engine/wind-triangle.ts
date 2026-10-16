import { normalizeDeg } from './geodesy';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export class WindTriangleError extends Error {
  constructor(
    readonly code: 'CROSSWIND_EXCEEDS_TAS' | 'HEADWIND_EXCEEDS_TAS',
    message: string,
  ) {
    super(message);
  }
}

export interface WindTriangle {
  windCorrectionDeg: number; // > 0: heading to the right of the course
  trueHeadingDeg: number;
  groundSpeedKt: number;
  crosswindKt: number; // > 0: wind from the right
  headwindKt: number; // > 0: headwind
}

// Wind "from" `windFromDeg` at `windKt`, true course `courseDeg`, true
// airspeed `tasKt`. No bound is put on the result: a wind the aircraft
// cannot fly against is an error, not a minimum ground speed.
export function solveWindTriangle(
  courseDeg: number,
  tasKt: number,
  windFromDeg: number,
  windKt: number,
): WindTriangle {
  const theta = (windFromDeg - courseDeg) * RAD;
  const crosswind = windKt * Math.sin(theta);
  const headwind = windKt * Math.cos(theta);
  if (Math.abs(crosswind) >= tasKt) {
    throw new WindTriangleError(
      'CROSSWIND_EXCEEDS_TAS',
      `Crosswind ${crosswind.toFixed(1)} kt >= TAS ${tasKt.toFixed(1)} kt`,
    );
  }
  const wca = Math.asin(crosswind / tasKt);
  const groundSpeed = tasKt * Math.cos(wca) - headwind;
  if (groundSpeed <= 0) {
    throw new WindTriangleError(
      'HEADWIND_EXCEEDS_TAS',
      `Wind stronger than the airspeed (GS ${groundSpeed.toFixed(1)} kt)`,
    );
  }
  return {
    windCorrectionDeg: wca * DEG,
    trueHeadingDeg: normalizeDeg(courseDeg + wca * DEG),
    groundSpeedKt: groundSpeed,
    crosswindKt: crosswind,
    headwindKt: headwind,
  };
}

// Winds are combined as vectors, never by averaging their directions.
export const windToComponents = (
  fromDeg: number,
  speedKt: number,
): { u: number; v: number } => ({
  // u east, v north, of the air movement (towards which it blows).
  u: -speedKt * Math.sin(fromDeg * RAD),
  v: -speedKt * Math.cos(fromDeg * RAD),
});

export const componentsToWind = (
  u: number,
  v: number,
): { fromDeg: number; speedKt: number } => {
  const speedKt = Math.sqrt(u * u + v * v);
  if (speedKt < 1e-9) return { fromDeg: 0, speedKt: 0 };
  return { fromDeg: normalizeDeg(Math.atan2(-u, -v) * DEG), speedKt };
};
