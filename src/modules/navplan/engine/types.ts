// Data shapes shared by the engine, the aircraft data and the API. Units are
// part of the field names: kt, NM, ft, L, kg, m, minutes, degrees.

export type FuelType = 'AVGAS_100LL' | 'UL91' | 'JET_A1' | 'MOGAS';

export const DEFAULT_FUEL_DENSITY_KG_PER_L: Record<FuelType, number> = {
  AVGAS_100LL: 0.72,
  UL91: 0.72,
  JET_A1: 0.8,
  MOGAS: 0.73,
};

export interface FuelTank {
  id: string;
  label: string;
  usableL: number;
  unusableL: number;
  armM: number;
}

export interface FuelData {
  type: FuelType;
  densityKgPerL: number;
  tanks: FuelTank[];
  taxiFuelL: number;
  // Tanks in the order they are used; empty: all tanks proportionally.
  burnOrder: string[];
}

export interface ClimbRow {
  pressureAltFt: number;
  timeMin: number;
  fuelL: number;
  distanceNm: number;
}

// Either the "time, fuel, distance to climb from sea level" table of the
// flight manual, or a simple model (Vy, rates at sea level and at the
// service ceiling, fuel flow).
export interface ClimbData {
  iasKt: number;
  table?: ClimbRow[] | null;
  seaLevelRateFpm?: number | null;
  ceilingRateFpm?: number | null;
  fuelFlowLph?: number | null;
}

export interface CruiseRow {
  pressureAltFt: number;
  setting: string;
  isaDeviationC: number;
  tasKt: number;
  fuelFlowLph: number;
}

export interface CruiseData {
  normalSetting: string;
  rows: CruiseRow[];
}

export interface DescentData {
  iasKt: number;
  rateFpm: number;
  fuelFlowLph: number;
}

export interface CalibrationRow {
  iasKt: number;
  casKt: number;
}

// AMC1 NCO.OP.125(b): holding fuel flow (30/45 min cases) and maximum
// continuous cruise power fuel flow (10 min local case), both at 1500 ft.
export interface ReserveData {
  holdingFuelFlowLph: number;
  maxContinuousFuelFlowLph: number;
}

export interface PerformanceData {
  fuel: FuelData;
  climb: ClimbData;
  cruise: CruiseData;
  descent: DescentData;
  reserve: ReserveData;
  arrivalFuelL: number;
  serviceCeilingFt: number | null;
  calibration: CalibrationRow[];
}

export type StationKind = 'SEAT' | 'BAGGAGE' | 'FUEL' | 'OTHER';
export type EnvelopeCategory = 'NORMAL' | 'UTILITY' | 'AEROBATIC';

export interface Station {
  id: string;
  label: string;
  kind: StationKind;
  armM: number;
  maxKg?: number | null;
  tankId?: string | null;
}

export interface CombinedLimit {
  stationIds: string[];
  maxKg: number;
  label: string;
}

export interface EnvelopePoint {
  armM: number;
  massKg: number;
}

export interface Envelope {
  category: EnvelopeCategory;
  points: EnvelopePoint[];
}

export interface MassBalanceData {
  emptyMassKg: number | null;
  emptyArmM: number | null;
  weighingDate: Date | string | null;
  weighingRef?: string | null;
  mtowKg: number | null;
  mlwKg: number | null;
  mzfwKg?: number | null;
  stations: Station[];
  combinedLimits: CombinedLimit[];
  envelopes: Envelope[];
}

export type CheckStatus = 'OK' | 'WARNING' | 'BLOCKING';

export const worstStatus = (...statuses: CheckStatus[]): CheckStatus =>
  statuses.includes('BLOCKING')
    ? 'BLOCKING'
    : statuses.includes('WARNING')
      ? 'WARNING'
      : 'OK';

// A message the pilot reads: a key of the API dictionaries and its
// parameters, written out in the language of the request at the edge.
export interface MessageRef {
  key: string;
  params?: Record<string, string | number>;
}
