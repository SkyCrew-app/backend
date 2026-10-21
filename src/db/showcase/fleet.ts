import {
  AircraftTemplate,
  templateByCode,
} from '../../modules/aircraft/flight-data/aircraft-templates';
import {
  CruiseRow,
  FuelTank,
  MassBalanceData,
  PerformanceData,
  Station,
} from '../../modules/navplan/engine/types';

// The showcase fleet and the flight data that lets the flight preparation
// work with it. Where a template holds a sourced figure (DR400-180 flight
// manual, EASA TCDS) it is kept; every figure a template leaves empty is a
// plausible value made up for the demonstration, and every record says so.

export const DEMO_DATA_WARNING =
  'Données de démonstration — ne pas utiliser pour un vol réel';

// Marks checked against the French register (immat.aviation-civile.gouv.fr,
// registered and deregistered aircraft) on 2026-10-16: none was ever used.
export const SHOWCASE_REGISTRATIONS = [
  'F-HZDA',
  'F-HZDB',
  'F-HZDC',
  'F-HZDE',
  'F-HZDM',
  'F-HZDS',
] as const;

export interface FleetAircraft {
  key: string;
  registration: string;
  model: string;
  year: number;
  templateCode: string;
  hourlyCost: number;
  // Airframe hours before the showcase history.
  priorHours: number;
  maxAltitude: number;
  cruiseSpeed: number;
  consumption: number;
  fuelCapacity: number;
  seats: number;
  // Only experienced pilots take it (instruction stays on the Robins).
  advanced: boolean;
  performance: PerformanceData;
  massBalance: MassBalanceData;
}

const IN = 0.0254;
const LB = 0.45359237;
const r = (value: number, digits = 3) =>
  Math.round(value * 10 ** digits) / 10 ** digits;

const cruise = (
  setting: string,
  flowLph: number,
  rows: [number, number][],
): CruiseRow[] =>
  rows.map(([pressureAltFt, tasKt]) => ({
    pressureAltFt,
    setting,
    isaDeviationC: 0,
    tasKt,
    fuelFlowLph: flowLph,
  }));

const fuelStations = (tanks: FuelTank[]): Station[] =>
  tanks.map((t) => ({
    id: `fuel-${t.id}`,
    label: t.label,
    kind: 'FUEL' as const,
    armM: t.armM,
    tankId: t.id,
  }));

const template = (code: string): AircraftTemplate => {
  const found = templateByCode(code);
  if (!found) throw new Error(`Showcase: no aircraft template ${code}`);
  return found;
};

const weighing = (
  registration: string,
  emptyMassKg: number,
  emptyArmM: number,
  weighingDate: string,
) => ({
  emptyMassKg,
  emptyArmM,
  weighingDate: new Date(weighingDate),
  weighingRef: `Pesée fictive ${registration} — ${DEMO_DATA_WARNING}`,
});

const demoSource = (code: string, extra = '') =>
  `${DEMO_DATA_WARNING}. ${extra}Valeurs complétées pour la démonstration à partir du modèle ${code}, sans manuel de vol : elles ne décrivent aucun avion réel.`;

const ROBIN_MAIN: FuelTank = {
  id: 'main',
  label: 'Réservoir principal / Main tank',
  usableL: 100,
  unusableL: 10,
  armM: 1.12,
};

// Robin DR400-120: TCDS masses, envelope and stations from the template;
// tank, performance and weighing made up.
const dr400120 = (): Pick<FleetAircraft, 'performance' | 'massBalance'> => {
  const t = template('DR400-120');
  const tanks = [ROBIN_MAIN];
  return {
    performance: {
      ...t.performance,
      fuel: { ...t.performance.fuel, tanks, burnOrder: [] },
      climb: {
        iasKt: 75,
        table: null,
        seaLevelRateFpm: 600,
        ceilingRateFpm: 100,
        fuelFlowLph: 28,
      },
      cruise: {
        normalSetting: '75%',
        rows: [
          ...cruise('75%', 24, [
            [0, 103],
            [4000, 106],
            [8000, 108],
          ]),
          ...cruise('65%', 20, [
            [0, 97],
            [4000, 100],
            [8000, 102],
          ]),
        ],
      },
      descent: { iasKt: 90, rateFpm: 500, fuelFlowLph: 14 },
      reserve: { holdingFuelFlowLph: 18, maxContinuousFuelFlowLph: 26 },
      serviceCeilingFt: 12000,
    },
    massBalance: {
      ...t.massBalance,
      ...weighing('F-HZDA', 548, 0.33, '2025-11-18'),
      stations: [
        ...t.massBalance.stations.filter((s) => s.kind !== 'FUEL'),
        ...fuelStations(tanks),
      ],
    },
  };
};

const dr400140b = (): Pick<FleetAircraft, 'performance' | 'massBalance'> => {
  const t = template('DR400-140B');
  const tanks = [ROBIN_MAIN];
  return {
    performance: {
      ...t.performance,
      fuel: { ...t.performance.fuel, tanks, burnOrder: [] },
      climb: {
        iasKt: 80,
        table: null,
        seaLevelRateFpm: 700,
        ceilingRateFpm: 100,
        fuelFlowLph: 38,
      },
      cruise: {
        normalSetting: '75%',
        rows: [
          ...cruise('75%', 32, [
            [0, 112],
            [4000, 116],
            [8000, 119],
          ]),
          ...cruise('60%', 26, [
            [0, 104],
            [4000, 107],
            [8000, 110],
          ]),
        ],
      },
      descent: { iasKt: 95, rateFpm: 500, fuelFlowLph: 18 },
      reserve: { holdingFuelFlowLph: 24, maxContinuousFuelFlowLph: 38 },
      serviceCeilingFt: 14000,
    },
    massBalance: {
      ...t.massBalance,
      ...weighing('F-HZDB', 592, 0.34, '2026-02-03'),
      stations: [
        ...t.massBalance.stations.filter((s) => s.kind !== 'FUEL'),
        ...fuelStations(tanks),
      ],
    },
  };
};

// DR400-180: the manual's figures are kept; climb fuel flow, descent and
// maximum continuous fuel flow, which the manual does not give, are made up.
const dr400180 = (): Pick<FleetAircraft, 'performance' | 'massBalance'> => {
  const t = template('DR400-180');
  return {
    performance: {
      ...t.performance,
      climb: { ...t.performance.climb, fuelFlowLph: 45 },
      descent: { iasKt: 100, rateFpm: 500, fuelFlowLph: 20 },
      reserve: { ...t.performance.reserve, maxContinuousFuelFlowLph: 45 },
    },
    massBalance: {
      ...t.massBalance,
      ...weighing('F-HZDC', 610, 0.35, '2025-09-22'),
    },
  };
};

// Cessna 172S: tank, masses and envelope from the TCDS template; seats and
// baggage at arms within the TCDS ranges, performance and weighing made up.
const c172s = (): Pick<FleetAircraft, 'performance' | 'massBalance'> => {
  const t = template('C172S');
  return {
    performance: {
      ...t.performance,
      climb: {
        iasKt: 74,
        table: null,
        seaLevelRateFpm: 730,
        ceilingRateFpm: 100,
        fuelFlowLph: 40,
      },
      cruise: {
        normalSetting: '75%',
        rows: [
          ...cruise('75%', 33, [
            [2000, 118],
            [6000, 122],
            [10000, 120],
          ]),
          ...cruise('65%', 29, [
            [2000, 112],
            [6000, 115],
            [10000, 117],
          ]),
        ],
      },
      descent: { iasKt: 90, rateFpm: 500, fuelFlowLph: 23 },
      reserve: { holdingFuelFlowLph: 25, maxContinuousFuelFlowLph: 38 },
      serviceCeilingFt: 14000,
    },
    massBalance: {
      ...t.massBalance,
      ...weighing('F-HZDE', 762, r(39.5 * IN), '2026-03-12'),
      stations: [
        {
          id: 'front',
          label: 'Sièges avant / Front seats',
          kind: 'SEAT',
          armM: r(37 * IN),
        },
        {
          id: 'rear',
          label: 'Sièges arrière / Rear seats',
          kind: 'SEAT',
          armM: r(73 * IN),
        },
        {
          id: 'baggage-a',
          label: 'Bagages A / Baggage A',
          kind: 'BAGGAGE',
          armM: r(95 * IN),
          maxKg: r(120 * LB, 1),
        },
        {
          id: 'baggage-b',
          label: 'Bagages B / Baggage B',
          kind: 'BAGGAGE',
          armM: r(123 * IN),
          maxKg: r(50 * LB, 1),
        },
        ...t.massBalance.stations,
      ],
      combinedLimits: [
        {
          stationIds: ['baggage-a', 'baggage-b'],
          maxKg: r(120 * LB, 1),
          label: 'Bagages A + B / Baggage A + B',
        },
      ],
    },
  };
};

// Piper PA-28-161 and Diamond DA40: no sourced template, every figure is
// made up for the demonstration.
const pa28161 = (): Pick<FleetAircraft, 'performance' | 'massBalance'> => {
  const t = template('PA28-161');
  const tanks: FuelTank[] = [
    {
      id: 'main',
      label: 'Réservoirs ailes / Wing tanks',
      usableL: 182,
      unusableL: 7.5,
      armM: r(95 * IN),
    },
  ];
  return {
    performance: {
      ...t.performance,
      fuel: { ...t.performance.fuel, tanks },
      climb: {
        iasKt: 79,
        table: null,
        seaLevelRateFpm: 645,
        ceilingRateFpm: 100,
        fuelFlowLph: 40,
      },
      cruise: {
        normalSetting: '75%',
        rows: [
          ...cruise('75%', 34, [
            [2000, 110],
            [6000, 113],
            [8000, 115],
          ]),
          ...cruise('65%', 30, [
            [2000, 104],
            [6000, 107],
            [8000, 109],
          ]),
        ],
      },
      descent: { iasKt: 95, rateFpm: 500, fuelFlowLph: 20 },
      reserve: { holdingFuelFlowLph: 24, maxContinuousFuelFlowLph: 38 },
      serviceCeilingFt: 11000,
    },
    massBalance: {
      ...weighing('F-HZDM', 680, r(86 * IN), '2025-12-09'),
      mtowKg: r(2440 * LB, 1),
      mlwKg: r(2440 * LB, 1),
      mzfwKg: null,
      stations: [
        {
          id: 'front',
          label: 'Sièges avant / Front seats',
          kind: 'SEAT',
          armM: r(80.5 * IN),
        },
        {
          id: 'rear',
          label: 'Sièges arrière / Rear seats',
          kind: 'SEAT',
          armM: r(118.1 * IN),
        },
        {
          id: 'baggage',
          label: 'Bagages / Baggage',
          kind: 'BAGGAGE',
          armM: r(142.8 * IN),
          maxKg: r(200 * LB, 1),
        },
        ...fuelStations(tanks),
      ],
      combinedLimits: [],
      envelopes: [
        {
          category: 'NORMAL',
          points: [
            { armM: r(83 * IN), massKg: r(1200 * LB, 1) },
            { armM: r(83 * IN), massKg: r(1950 * LB, 1) },
            { armM: r(87 * IN), massKg: r(2440 * LB, 1) },
            { armM: r(93 * IN), massKg: r(2440 * LB, 1) },
            { armM: r(93 * IN), massKg: r(1200 * LB, 1) },
          ],
        },
      ],
    },
  };
};

const da40 = (): Pick<FleetAircraft, 'performance' | 'massBalance'> => {
  const t = template('DA40');
  const tanks: FuelTank[] = [
    {
      id: 'main',
      label: 'Réservoirs ailes / Wing tanks',
      usableL: 151,
      unusableL: 4,
      armM: 2.63,
    },
  ];
  return {
    performance: {
      ...t.performance,
      fuel: { ...t.performance.fuel, tanks },
      climb: {
        iasKt: 75,
        table: null,
        seaLevelRateFpm: 900,
        ceilingRateFpm: 100,
        fuelFlowLph: 45,
      },
      cruise: {
        normalSetting: '75%',
        rows: [
          ...cruise('75%', 36, [
            [2000, 128],
            [6000, 133],
            [10000, 136],
          ]),
          ...cruise('60%', 30, [
            [2000, 118],
            [6000, 122],
            [10000, 125],
          ]),
        ],
      },
      descent: { iasKt: 110, rateFpm: 500, fuelFlowLph: 20 },
      reserve: { holdingFuelFlowLph: 25, maxContinuousFuelFlowLph: 40 },
      serviceCeilingFt: 16400,
    },
    massBalance: {
      ...weighing('F-HZDS', 800, 2.44, '2026-01-27'),
      mtowKg: 1150,
      mlwKg: 1092,
      mzfwKg: null,
      stations: [
        {
          id: 'front',
          label: 'Sièges avant / Front seats',
          kind: 'SEAT',
          armM: 2.3,
        },
        {
          id: 'rear',
          label: 'Sièges arrière / Rear seats',
          kind: 'SEAT',
          armM: 3.25,
        },
        {
          id: 'baggage',
          label: 'Bagages / Baggage',
          kind: 'BAGGAGE',
          armM: 3.65,
          maxKg: 30,
        },
        ...fuelStations(tanks),
      ],
      combinedLimits: [],
      envelopes: [
        {
          category: 'NORMAL',
          points: [
            { armM: 2.4, massKg: 700 },
            { armM: 2.4, massKg: 980 },
            { armM: 2.46, massKg: 1150 },
            { armM: 2.59, massKg: 1150 },
            { armM: 2.59, massKg: 700 },
          ],
        },
      ],
    },
  };
};

export const buildFleet = (): FleetAircraft[] => [
  {
    key: 'dr400-120',
    registration: 'F-HZDA',
    model: 'Robin DR400-120 Dauphin',
    year: 2004,
    templateCode: 'DR400-120',
    hourlyCost: 162,
    priorHours: 7420,
    maxAltitude: 12000,
    cruiseSpeed: 105,
    consumption: 24,
    fuelCapacity: 110,
    seats: 4,
    advanced: false,
    ...dr400120(),
  },
  {
    key: 'dr400-140b',
    registration: 'F-HZDB',
    model: 'Robin DR400-140B Major',
    year: 2011,
    templateCode: 'DR400-140B',
    hourlyCost: 184,
    priorHours: 5310,
    maxAltitude: 14000,
    cruiseSpeed: 115,
    consumption: 32,
    fuelCapacity: 110,
    seats: 4,
    advanced: false,
    ...dr400140b(),
  },
  {
    key: 'dr400-180',
    registration: 'F-HZDC',
    model: 'Robin DR400-180 Régent',
    year: 2016,
    templateCode: 'DR400-180',
    hourlyCost: 206,
    priorHours: 3185,
    maxAltitude: 15500,
    cruiseSpeed: 134,
    consumption: 39,
    fuelCapacity: 190,
    seats: 4,
    advanced: false,
    ...dr400180(),
  },
  {
    key: 'c172s',
    registration: 'F-HZDE',
    model: 'Cessna 172S Skyhawk SP',
    year: 2008,
    templateCode: 'C172S',
    hourlyCost: 214,
    priorHours: 6040,
    maxAltitude: 14000,
    cruiseSpeed: 120,
    consumption: 33,
    fuelCapacity: 212,
    seats: 4,
    advanced: false,
    ...c172s(),
  },
  {
    key: 'pa28-161',
    registration: 'F-HZDM',
    model: 'Piper PA-28-161 Warrior II',
    year: 1999,
    templateCode: 'PA28-161',
    hourlyCost: 192,
    priorHours: 8760,
    maxAltitude: 11000,
    cruiseSpeed: 113,
    consumption: 34,
    fuelCapacity: 189,
    seats: 4,
    advanced: false,
    ...pa28161(),
  },
  {
    key: 'da40',
    registration: 'F-HZDS',
    model: 'Diamond DA40 180',
    year: 2019,
    templateCode: 'DA40',
    hourlyCost: 228,
    priorHours: 1460,
    maxAltitude: 16400,
    cruiseSpeed: 133,
    consumption: 36,
    fuelCapacity: 155,
    seats: 4,
    advanced: true,
    ...da40(),
  },
];

export const performanceSource = (aircraft: FleetAircraft): string =>
  aircraft.templateCode === 'DR400-180'
    ? `${DEMO_DATA_WARNING}. Débit en montée, descente et débit à la puissance maximale continue inventés pour la démonstration ; le reste vient du modèle : ${template('DR400-180').source}`
    : aircraft.templateCode === 'C172S' ||
        aircraft.templateCode.startsWith('DR400')
      ? demoSource(
          aircraft.templateCode,
          'Masses et centrage du modèle (EASA TCDS) ; performances, réservoirs manquants et pesée inventés. ',
        )
      : demoSource(aircraft.templateCode);
