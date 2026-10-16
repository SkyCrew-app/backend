import { isaTemperatureC, trueAirspeedKt } from './atmosphere';
import { CalibrationRow, ClimbData, CruiseData, CruiseRow } from './types';

// Reading the flight manual tables: linear (bilinear for cruise) and never
// beyond the table: outside it the manual says nothing and neither do we.

export class PerformanceError extends Error {
  constructor(
    readonly code:
      | 'OUT_OF_TABLE'
      | 'NO_CRUISE_SETTING'
      | 'NO_CLIMB_DATA'
      | 'ABOVE_CEILING',
    readonly params: Record<string, string | number> = {},
  ) {
    super(`${code} ${JSON.stringify(params)}`);
  }
}

const interpolate = (
  x: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
) => (x1 === x0 ? y0 : y0 + ((x - x0) * (y1 - y0)) / (x1 - x0));

// Linear interpolation in a table sorted by `key`; null outside it.
function lookup<T>(
  rows: T[],
  key: (row: T) => number,
  value: number,
  read: (row: T) => number,
): number | null {
  const sorted = [...rows].sort((a, b) => key(a) - key(b));
  if (sorted.length === 0) return null;
  if (sorted.length === 1)
    return key(sorted[0]) === value ? read(sorted[0]) : null;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (value >= key(a) - 1e-9 && value <= key(b) + 1e-9) {
      return interpolate(value, key(a), key(b), read(a), read(b));
    }
  }
  return null;
}

export function casFromIas(
  calibration: CalibrationRow[],
  iasKt: number,
): number {
  if (!calibration || calibration.length < 2) return iasKt;
  const cas = lookup(
    calibration,
    (r) => r.iasKt,
    iasKt,
    (r) => r.casKt,
  );
  // Outside the calibration table, CAS = IAS (stated on the plan).
  return cas ?? iasKt;
}

export interface CruisePerformance {
  tasKt: number;
  fuelFlowLph: number;
  // The table has a single temperature column: the deviation from ISA was
  // not taken into account.
  temperatureIgnored: boolean;
}

export function cruiseAt(
  cruise: CruiseData,
  setting: string,
  pressureAltFt: number,
  isaDeviationC: number,
): CruisePerformance {
  const rows = cruise.rows.filter((row) => row.setting === setting);
  if (rows.length === 0) {
    throw new PerformanceError('NO_CRUISE_SETTING', { setting });
  }
  const columns = [...new Set(rows.map((r) => r.isaDeviationC))].sort(
    (a, b) => a - b,
  );
  const atColumn = (deviation: number) => {
    const column = rows.filter((r) => r.isaDeviationC === deviation);
    const tas = lookup(
      column,
      (r) => r.pressureAltFt,
      pressureAltFt,
      (r) => r.tasKt,
    );
    const flow = lookup(
      column,
      (r) => r.pressureAltFt,
      pressureAltFt,
      (r) => r.fuelFlowLph,
    );
    if (tas === null || flow === null) {
      const altitudes = column.map((r) => r.pressureAltFt);
      throw new PerformanceError('OUT_OF_TABLE', {
        table: 'cruise',
        value: Math.round(pressureAltFt),
        min: Math.min(...altitudes),
        max: Math.max(...altitudes),
      });
    }
    return { tas, flow };
  };

  if (columns.length === 1) {
    const { tas, flow } = atColumn(columns[0]);
    return {
      tasKt: tas,
      fuelFlowLph: flow,
      temperatureIgnored: Math.abs(isaDeviationC - columns[0]) > 5,
    };
  }
  const low = columns.filter((c) => c <= isaDeviationC).pop();
  const high = columns.find((c) => c >= isaDeviationC);
  if (low === undefined || high === undefined) {
    throw new PerformanceError('OUT_OF_TABLE', {
      table: 'cruise-temperature',
      value: Math.round(isaDeviationC),
      min: columns[0],
      max: columns[columns.length - 1],
    });
  }
  const a = atColumn(low);
  const b = atColumn(high);
  return {
    tasKt: interpolate(isaDeviationC, low, high, a.tas, b.tas),
    fuelFlowLph: interpolate(isaDeviationC, low, high, a.flow, b.flow),
    temperatureIgnored: false,
  };
}

export interface ClimbPerformance {
  timeMin: number;
  fuelL: number;
  stillAirNm: number;
  tasKt: number;
}

// A climb table that starts at sea level is read down to this pressure
// altitude (a high QNH puts low fields below 0 ft pressure altitude).
const CLIMB_TABLE_BELOW_SEA_LEVEL_FT = -1000;

function climbFromTable(rows: ClimbRowLike[], zp: number) {
  const sorted = [...rows].sort((a, b) => a.pressureAltFt - b.pressureAltFt);
  let value = zp;
  if (
    sorted.length >= 2 &&
    sorted[0].pressureAltFt === 0 &&
    zp < 0 &&
    zp >= CLIMB_TABLE_BELOW_SEA_LEVEL_FT
  ) {
    const [a, b] = sorted;
    return {
      timeMin: interpolate(
        value,
        a.pressureAltFt,
        b.pressureAltFt,
        a.timeMin,
        b.timeMin,
      ),
      fuelL: interpolate(
        value,
        a.pressureAltFt,
        b.pressureAltFt,
        a.fuelL,
        b.fuelL,
      ),
      distanceNm: interpolate(
        value,
        a.pressureAltFt,
        b.pressureAltFt,
        a.distanceNm,
        b.distanceNm,
      ),
    };
  }
  const time = lookup(
    sorted,
    (r) => r.pressureAltFt,
    value,
    (r) => r.timeMin,
  );
  const fuel = lookup(
    sorted,
    (r) => r.pressureAltFt,
    value,
    (r) => r.fuelL,
  );
  const distance = lookup(
    sorted,
    (r) => r.pressureAltFt,
    value,
    (r) => r.distanceNm,
  );
  if (time === null || fuel === null || distance === null) {
    value = Math.round(zp);
    throw new PerformanceError('OUT_OF_TABLE', {
      table: 'climb',
      value,
      min: sorted[0]?.pressureAltFt ?? 0,
      max: sorted[sorted.length - 1]?.pressureAltFt ?? 0,
    });
  }
  return { timeMin: time, fuelL: fuel, distanceNm: distance };
}

type ClimbRowLike = {
  pressureAltFt: number;
  timeMin: number;
  fuelL: number;
  distanceNm: number;
};

// Time, fuel and still-air distance to climb from one pressure altitude to
// another.
export function climbBetween(
  climb: ClimbData,
  fromZpFt: number,
  toZpFt: number,
  options: {
    serviceCeilingFt: number | null;
    calibration: CalibrationRow[];
    temperatureAt?: (zp: number) => number;
  },
): ClimbPerformance {
  if (toZpFt <= fromZpFt) {
    return { timeMin: 0, fuelL: 0, stillAirNm: 0, tasKt: 0 };
  }
  const temperatureAt = options.temperatureAt ?? isaTemperatureC;
  const midZp = (fromZpFt + toZpFt) / 2;
  const tasAtMid = trueAirspeedKt(
    casFromIas(options.calibration, climb.iasKt),
    midZp,
    temperatureAt(midZp),
  );

  if (climb.table && climb.table.length >= 2) {
    const a = climbFromTable(climb.table, fromZpFt);
    const b = climbFromTable(climb.table, toZpFt);
    const timeMin = b.timeMin - a.timeMin;
    const stillAirNm = b.distanceNm - a.distanceNm;
    return {
      timeMin,
      fuelL: b.fuelL - a.fuelL,
      stillAirNm,
      tasKt:
        timeMin > 0 && stillAirNm > 0 ? (stillAirNm / timeMin) * 60 : tasAtMid,
    };
  }

  const r0 = climb.seaLevelRateFpm;
  const ceiling = options.serviceCeilingFt;
  if (!r0 || !climb.fuelFlowLph || !ceiling) {
    throw new PerformanceError('NO_CLIMB_DATA');
  }
  if (toZpFt > ceiling) {
    throw new PerformanceError('ABOVE_CEILING', {
      value: Math.round(toZpFt),
      ceiling,
    });
  }
  // Rate of climb decreasing linearly with altitude, down to the rate at the
  // service ceiling (100 ft/min by definition when not given).
  const rc = climb.ceilingRateFpm ?? 100;
  const rate = (z: number) => r0 - ((r0 - rc) * z) / ceiling;
  const timeMin =
    Math.abs(r0 - rc) < 1e-9
      ? (toZpFt - fromZpFt) / r0
      : (ceiling / (r0 - rc)) * Math.log(rate(fromZpFt) / rate(toZpFt));
  return {
    timeMin,
    fuelL: (timeMin / 60) * climb.fuelFlowLph,
    stillAirNm: (timeMin / 60) * tasAtMid,
    tasKt: tasAtMid,
  };
}

export const cruiseRowsSettings = (rows: CruiseRow[]): string[] => [
  ...new Set(rows.map((r) => r.setting)),
];
