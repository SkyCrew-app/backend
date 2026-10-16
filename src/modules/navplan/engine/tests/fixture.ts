import { DEFAULT_FUEL_SETTINGS } from '../fuel';
import { EngineInput, EnginePoint } from '../engine';

// A small plan for the engine tests: Nantes (LFRS) to Rennes (LFRN), the
// route of the reality check's night flight, with simple performance.
export const aerodrome = (
  ident: string,
  lat: number,
  lon: number,
  elevationFt: number,
): EnginePoint => ({
  id: `AD:${ident}`,
  type: 'AERODROME',
  ident,
  name: ident,
  lat,
  lon,
  elevationFt,
  frequency: null,
  aerodromeIcao: ident,
  mandatory: null,
});

export const LFRS = aerodrome('LFRS', 47.1532, -1.6107, 90);
export const LFRN = aerodrome('LFRN', 48.0695, -1.7348, 124);
export const LFRD = aerodrome('LFRD', 48.5877, -2.08, 219);

export const engineInput = (
  changes: Partial<EngineInput> = {},
): EngineInput => ({
  departureTime: new Date('2026-10-16T10:00:00Z'),
  departure: LFRS,
  destination: LFRN,
  alternate: null,
  waypoints: [],
  legs: [{ altitudeFt: 2500, cruiseSetting: null, windOverride: null }],
  reserveCase: 'VFR_DAY',
  qnhHpa: 1013.25,
  qnhSource: 'INPUT',
  loads: [],
  fuel: [{ tankId: 'main', liters: 150 }],
  envelopeCategory: 'NORMAL',
  performance: {
    fuel: {
      type: 'AVGAS_100LL',
      densityKgPerL: 0.72,
      tanks: [
        { id: 'main', label: 'Main', usableL: 200, unusableL: 0, armM: 1 },
      ],
      taxiFuelL: 3,
      burnOrder: [],
    },
    climb: {
      iasKt: 75,
      table: null,
      seaLevelRateFpm: 700,
      ceilingRateFpm: 100,
      fuelFlowLph: 40,
    },
    cruise: {
      normalSetting: '75%',
      rows: [
        {
          pressureAltFt: 0,
          setting: '75%',
          isaDeviationC: 0,
          tasKt: 110,
          fuelFlowLph: 30,
        },
        {
          pressureAltFt: 10000,
          setting: '75%',
          isaDeviationC: 0,
          tasKt: 110,
          fuelFlowLph: 30,
        },
      ],
    },
    descent: { iasKt: 90, rateFpm: 500, fuelFlowLph: 20 },
    reserve: { holdingFuelFlowLph: 24, maxContinuousFuelFlowLph: 34 },
    arrivalFuelL: 0,
    serviceCeilingFt: 14000,
    calibration: [],
  },
  performanceStatus: 'VALIDATED',
  massBalance: null,
  massBalanceValidated: false,
  settings: {
    ...DEFAULT_FUEL_SETTINGS,
    verticalMarginFt: 300,
    defaultCircuitHeightFt: 1000,
    defaultDescentFpm: 500,
  },
  circuitHeightFt: null,
  airspaces: [],
  navdata: {
    airac: 'OURAIRPORTS',
    effectiveFrom: new Date('2026-10-16T00:00:00Z'),
    effectiveTo: new Date('2026-10-16T00:00:00Z'),
    stale: false,
    cyclesBehind: 0,
    source: 'OurAirports (domaine public)',
    hasAirspaces: false,
  },
  wind: null,
  windSource: 'none',
  weather: [],
  ...changes,
});
