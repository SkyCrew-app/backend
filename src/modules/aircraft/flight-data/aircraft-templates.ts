import {
  CruiseRow,
  Envelope,
  MassBalanceData,
  PerformanceData,
  Station,
} from '../../navplan/engine/types';

// Type templates a club copies onto one of its aircraft, then corrects from
// the flight manual and the weighing report of THAT aircraft. Numbers only
// (no manual text). Every figure is indicative and marked so: an aircraft
// carrying them is refused for mass and balance, and its performance is
// flagged, until an administrator confirms its own values
// (validateAircraftData).
//
// Sources: EASA / FAA type certificate data sheets for the masses, datum and
// CG ranges where cited; typical published manual figures for speeds and
// fuel flows (rounded). Values marked "non sourcé" are placeholders shaped
// like the type's data and must be replaced from the manual.

export const TEMPLATE_WARNING =
  'Modèle à vérifier avec le manuel de vol et la fiche de pesée de VOTRE avion — valeurs indicatives / Template: check against YOUR aircraft flight manual and weighing report';

const IN = 0.0254;
const LB = 0.45359237;
const USG = 3.785411784;
const r = (value: number, digits = 4) =>
  Math.round(value * 10 ** digits) / 10 ** digits;

export interface AircraftTemplate {
  code: string;
  label: string;
  source: string;
  performance: PerformanceData;
  massBalance: Omit<
    MassBalanceData,
    'emptyMassKg' | 'emptyArmM' | 'weighingDate' | 'weighingRef'
  >;
}

// ISA cruise table from 0 to `maxFt` every 2000 ft.
const cruiseRows = (
  settings: {
    name: string;
    tasAt0: number;
    tasPer1000: number;
    flowLph: number;
  }[],
  maxFt: number,
): CruiseRow[] =>
  settings.flatMap((s) =>
    Array.from({ length: Math.floor(maxFt / 2000) + 1 }, (_, i) => ({
      pressureAltFt: i * 2000,
      setting: s.name,
      isaDeviationC: 0,
      tasKt: r(s.tasAt0 + (s.tasPer1000 * i * 2000) / 1000, 1),
      fuelFlowLph: s.flowLph,
    })),
  );

const envelope = (
  category: Envelope['category'],
  points: [number, number][],
): Envelope => ({
  category,
  points: points.map(([armM, massKg]) => ({
    armM: r(armM),
    massKg: r(massKg, 1),
  })),
});

const robin = (options: {
  code: string;
  label: string;
  mtow: number;
  forwardSlope: [number, number]; // [mass where the forward limit starts sloping, forward arm at MTOW]
  tanks: {
    id: string;
    label: string;
    usableL: number;
    unusableL: number;
    armM: number;
  }[];
  cruise: {
    name: string;
    tasAt0: number;
    tasPer1000: number;
    flowLph: number;
  }[];
  climbRate: number;
  climbFlow: number;
  ceiling: number;
  holding: number;
  maxContinuous: number;
  source: string;
}): AircraftTemplate => {
  const stations: Station[] = [
    {
      id: 'front',
      label: 'Sièges avant / Front seats',
      kind: 'SEAT',
      armM: 0.41,
    },
    {
      id: 'rear',
      label: 'Banquette arrière / Rear seats',
      kind: 'SEAT',
      armM: 1.19,
    },
    {
      id: 'baggage',
      label: 'Bagages / Baggage',
      kind: 'BAGGAGE',
      armM: 1.9,
      maxKg: 60,
    },
  ];
  return {
    code: options.code,
    label: options.label,
    source: `${TEMPLATE_WARNING}. ${options.source}`,
    performance: {
      fuel: {
        type: 'AVGAS_100LL',
        densityKgPerL: 0.72,
        tanks: options.tanks,
        taxiFuelL: 3,
        burnOrder: [],
      },
      climb: {
        iasKt: 76,
        table: null,
        seaLevelRateFpm: options.climbRate,
        ceilingRateFpm: 100,
        fuelFlowLph: options.climbFlow,
      },
      cruise: {
        normalSetting: options.cruise[0].name,
        rows: cruiseRows(options.cruise, 10000),
      },
      descent: { iasKt: 100, rateFpm: 500, fuelFlowLph: 18 },
      reserve: {
        holdingFuelFlowLph: options.holding,
        maxContinuousFuelFlowLph: options.maxContinuous,
      },
      arrivalFuelL: 0,
      serviceCeilingFt: options.ceiling,
      calibration: [],
    },
    massBalance: {
      mtowKg: options.mtow,
      mlwKg: options.mtow,
      mzfwKg: null,
      stations: [
        ...stations,
        ...options.tanks.map((t) => ({
          id: `fuel-${t.id}`,
          label: t.label,
          kind: 'FUEL' as const,
          armM: t.armM,
          tankId: t.id,
        })),
      ],
      combinedLimits: [],
      // Datum: wing leading edge. Forward limit 0.205 m up to the mass where
      // it starts sloping, aft limit 0.564 m.
      envelopes: [
        envelope('NORMAL', [
          [0.205, 500],
          [0.205, options.forwardSlope[0]],
          [options.forwardSlope[1], options.mtow],
          [0.564, options.mtow],
          [0.564, 500],
        ]),
      ],
    },
  };
};

const ROBIN_MAIN = {
  id: 'main',
  label: 'Réservoir principal / Main tank',
  usableL: 109,
  unusableL: 1,
  armM: 1.12,
};
const ROBIN_AUX = {
  id: 'aux',
  label: 'Réservoir supplémentaire / Auxiliary tank',
  usableL: 50,
  unusableL: 0,
  armM: 1.6,
};

export const AIRCRAFT_TEMPLATES: AircraftTemplate[] = [
  robin({
    code: 'DR400-120',
    label: 'Robin DR400-120 (Dauphin 2+2)',
    mtow: 900,
    forwardSlope: [700, 0.36],
    tanks: [ROBIN_MAIN],
    cruise: [
      { name: '75%', tasAt0: 103, tasPer1000: 1.5, flowLph: 25 },
      { name: '65%', tasAt0: 96, tasPer1000: 1.5, flowLph: 22 },
    ],
    climbRate: 600,
    climbFlow: 28,
    ceiling: 12000,
    holding: 18,
    maxContinuous: 27,
    source:
      'MTOW et limites de centrage : EASA TCDS A.039 (Robin DR400), à confirmer ; bras et débits non sourcés.',
  }),
  robin({
    code: 'DR400-140B',
    label: 'Robin DR400-140B (Major)',
    mtow: 1000,
    forwardSlope: [785, 0.38],
    tanks: [ROBIN_MAIN],
    cruise: [
      { name: '75%', tasAt0: 116, tasPer1000: 1.6, flowLph: 32 },
      { name: '65%', tasAt0: 109, tasPer1000: 1.6, flowLph: 28 },
    ],
    climbRate: 750,
    climbFlow: 38,
    ceiling: 13000,
    holding: 22,
    maxContinuous: 36,
    source:
      'MTOW et limites de centrage : EASA TCDS A.039 (Robin DR400), à confirmer ; bras et débits non sourcés.',
  }),
  robin({
    code: 'DR400-160',
    label: 'Robin DR400-160 (Chevalier)',
    mtow: 1050,
    forwardSlope: [800, 0.39],
    tanks: [ROBIN_MAIN, ROBIN_AUX],
    cruise: [
      { name: '75%', tasAt0: 120, tasPer1000: 1.6, flowLph: 33 },
      { name: '65%', tasAt0: 112, tasPer1000: 1.6, flowLph: 29 },
    ],
    climbRate: 780,
    climbFlow: 40,
    ceiling: 13500,
    holding: 23,
    maxContinuous: 37,
    source:
      'MTOW et limites de centrage : EASA TCDS A.039 (Robin DR400), à confirmer ; bras et débits non sourcés.',
  }),
  robin({
    code: 'DR400-180',
    label: 'Robin DR400-180 (Régent)',
    mtow: 1100,
    forwardSlope: [820, 0.4],
    tanks: [ROBIN_MAIN, ROBIN_AUX],
    cruise: [
      { name: '75%', tasAt0: 127, tasPer1000: 1.7, flowLph: 38 },
      { name: '65%', tasAt0: 119, tasPer1000: 1.7, flowLph: 33 },
    ],
    climbRate: 830,
    climbFlow: 45,
    ceiling: 15000,
    holding: 26,
    maxContinuous: 42,
    source:
      'MTOW et limites de centrage : EASA TCDS A.039 (Robin DR400), à confirmer ; bras et débits non sourcés.',
  }),
  {
    code: 'C172S',
    label: 'Cessna 172S Skyhawk SP',
    source: `${TEMPLATE_WARNING}. Datum : face avant de la cloison pare-feu ; MTOW 2550 lb, centrage 35.0-47.3 in (41.0 in à 2550 lb) : FAA TCDS 3A12 ; bras des stations et débits : valeurs usuelles du manuel, à vérifier.`,
    performance: {
      fuel: {
        type: 'AVGAS_100LL',
        densityKgPerL: 0.72,
        tanks: [
          {
            id: 'main',
            label: 'Réservoirs ailes / Wing tanks',
            usableL: r(53 * USG, 1),
            unusableL: r(3 * USG, 1),
            armM: r(48 * IN),
          },
        ],
        taxiFuelL: 4,
        burnOrder: [],
      },
      climb: {
        iasKt: 74,
        table: null,
        seaLevelRateFpm: 730,
        ceilingRateFpm: 100,
        fuelFlowLph: 42,
      },
      cruise: {
        normalSetting: '2400 rpm',
        rows: cruiseRows(
          [
            { name: '2400 rpm', tasAt0: 112, tasPer1000: 1.7, flowLph: 32 },
            { name: '2200 rpm', tasAt0: 104, tasPer1000: 1.5, flowLph: 27 },
          ],
          10000,
        ),
      },
      descent: { iasKt: 90, rateFpm: 500, fuelFlowLph: 20 },
      reserve: { holdingFuelFlowLph: 24, maxContinuousFuelFlowLph: 36 },
      arrivalFuelL: 0,
      serviceCeilingFt: 14000,
      calibration: [],
    },
    massBalance: {
      mtowKg: r(2550 * LB, 1),
      mlwKg: r(2550 * LB, 1),
      mzfwKg: null,
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
          id: 'baggageA',
          label: 'Bagages zone A / Baggage A',
          kind: 'BAGGAGE',
          armM: r(95 * IN),
          maxKg: r(120 * LB, 1),
        },
        {
          id: 'baggageB',
          label: 'Bagages zone B / Baggage B',
          kind: 'BAGGAGE',
          armM: r(123 * IN),
          maxKg: r(50 * LB, 1),
        },
        {
          id: 'fuel-main',
          label: 'Carburant / Fuel',
          kind: 'FUEL',
          armM: r(48 * IN),
          tankId: 'main',
        },
      ],
      combinedLimits: [
        {
          stationIds: ['baggageA', 'baggageB'],
          maxKg: r(120 * LB, 1),
          label: 'Bagages A + B / Baggage A + B',
        },
      ],
      envelopes: [
        envelope('NORMAL', [
          [35 * IN, 1500 * LB],
          [35 * IN, 1950 * LB],
          [41 * IN, 2550 * LB],
          [47.3 * IN, 2550 * LB],
          [47.3 * IN, 1500 * LB],
        ]),
      ],
    },
  },
  {
    code: 'PA28-161',
    label: 'Piper PA-28-161 Warrior',
    source: `${TEMPLATE_WARNING}. Datum : 78.4 in en avant du bord d'attaque ; MTOW 2440 lb : FAA TCDS 2A13 ; limites de centrage, bras et débits : non sourcés, à relever dans le manuel.`,
    performance: {
      fuel: {
        type: 'AVGAS_100LL',
        densityKgPerL: 0.72,
        tanks: [
          {
            id: 'main',
            label: 'Réservoirs ailes / Wing tanks',
            usableL: r(48 * USG, 1),
            unusableL: r(2 * USG, 1),
            armM: r(95 * IN),
          },
        ],
        taxiFuelL: 4,
        burnOrder: [],
      },
      climb: {
        iasKt: 79,
        table: null,
        seaLevelRateFpm: 640,
        ceilingRateFpm: 100,
        fuelFlowLph: 40,
      },
      cruise: {
        normalSetting: '75%',
        rows: cruiseRows(
          [
            { name: '75%', tasAt0: 110, tasPer1000: 1.6, flowLph: 32 },
            { name: '65%', tasAt0: 103, tasPer1000: 1.5, flowLph: 28 },
          ],
          10000,
        ),
      },
      descent: { iasKt: 95, rateFpm: 500, fuelFlowLph: 20 },
      reserve: { holdingFuelFlowLph: 23, maxContinuousFuelFlowLph: 36 },
      arrivalFuelL: 0,
      serviceCeilingFt: 11000,
      calibration: [],
    },
    massBalance: {
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
        {
          id: 'fuel-main',
          label: 'Carburant / Fuel',
          kind: 'FUEL',
          armM: r(95 * IN),
          tankId: 'main',
        },
      ],
      combinedLimits: [],
      envelopes: [
        envelope('NORMAL', [
          [83 * IN, 1200 * LB],
          [83 * IN, 1950 * LB],
          [87 * IN, 2440 * LB],
          [93 * IN, 2440 * LB],
          [93 * IN, 1200 * LB],
        ]),
      ],
    },
  },
  {
    code: 'DA40',
    label: 'Diamond DA40 (AVGAS)',
    source: `${TEMPLATE_WARNING}. MTOW 1150 kg et limites de centrage : EASA TCDS A.022 (DA40), selon variante ; bras et débits non sourcés.`,
    performance: {
      fuel: {
        type: 'AVGAS_100LL',
        densityKgPerL: 0.72,
        tanks: [
          {
            id: 'main',
            label: 'Réservoirs ailes / Wing tanks',
            usableL: r(40 * USG, 1),
            unusableL: r(1 * USG, 1),
            armM: 2.63,
          },
        ],
        taxiFuelL: 4,
        burnOrder: [],
      },
      climb: {
        iasKt: 66,
        table: null,
        seaLevelRateFpm: 1000,
        ceilingRateFpm: 100,
        fuelFlowLph: 50,
      },
      cruise: {
        normalSetting: '75%',
        rows: cruiseRows(
          [
            { name: '75%', tasAt0: 128, tasPer1000: 1.8, flowLph: 37 },
            { name: '60%', tasAt0: 117, tasPer1000: 1.6, flowLph: 30 },
          ],
          10000,
        ),
      },
      descent: { iasKt: 110, rateFpm: 500, fuelFlowLph: 22 },
      reserve: { holdingFuelFlowLph: 26, maxContinuousFuelFlowLph: 45 },
      arrivalFuelL: 0,
      serviceCeilingFt: 16000,
      calibration: [],
    },
    massBalance: {
      mtowKg: 1150,
      mlwKg: 1150,
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
        {
          id: 'fuel-main',
          label: 'Carburant / Fuel',
          kind: 'FUEL',
          armM: 2.63,
          tankId: 'main',
        },
      ],
      combinedLimits: [],
      envelopes: [
        envelope('NORMAL', [
          [2.4, 780],
          [2.4, 980],
          [2.46, 1150],
          [2.59, 1150],
          [2.59, 780],
        ]),
      ],
    },
  },
  {
    code: 'TB10',
    label: 'Socata TB10 Tobago',
    source: `${TEMPLATE_WARNING}. MTOW 1150 kg : EASA TCDS (TB series), à confirmer ; bras, enveloppe et débits non sourcés (structure seulement).`,
    performance: {
      fuel: {
        type: 'AVGAS_100LL',
        densityKgPerL: 0.72,
        tanks: [
          {
            id: 'main',
            label: 'Réservoirs ailes / Wing tanks',
            usableL: 204,
            unusableL: 6,
            armM: 1.15,
          },
        ],
        taxiFuelL: 3,
        burnOrder: [],
      },
      climb: {
        iasKt: 80,
        table: null,
        seaLevelRateFpm: 790,
        ceilingRateFpm: 100,
        fuelFlowLph: 45,
      },
      cruise: {
        normalSetting: '75%',
        rows: cruiseRows(
          [
            { name: '75%', tasAt0: 118, tasPer1000: 1.6, flowLph: 38 },
            { name: '65%', tasAt0: 110, tasPer1000: 1.5, flowLph: 33 },
          ],
          10000,
        ),
      },
      descent: { iasKt: 100, rateFpm: 500, fuelFlowLph: 22 },
      reserve: { holdingFuelFlowLph: 26, maxContinuousFuelFlowLph: 42 },
      arrivalFuelL: 0,
      serviceCeilingFt: 13000,
      calibration: [],
    },
    massBalance: {
      mtowKg: 1150,
      mlwKg: 1150,
      mzfwKg: null,
      stations: [
        {
          id: 'front',
          label: 'Sièges avant / Front seats',
          kind: 'SEAT',
          armM: 1.06,
        },
        {
          id: 'rear',
          label: 'Banquette arrière / Rear seats',
          kind: 'SEAT',
          armM: 2.03,
        },
        {
          id: 'baggage',
          label: 'Bagages / Baggage',
          kind: 'BAGGAGE',
          armM: 2.67,
          maxKg: 45,
        },
        {
          id: 'fuel-main',
          label: 'Carburant / Fuel',
          kind: 'FUEL',
          armM: 1.15,
          tankId: 'main',
        },
      ],
      combinedLimits: [],
      envelopes: [
        envelope('NORMAL', [
          [0.98, 700],
          [0.98, 900],
          [1.05, 1150],
          [1.26, 1150],
          [1.26, 700],
        ]),
      ],
    },
  },
  {
    code: 'P2008JC',
    label: 'Tecnam P2008 JC',
    source: `${TEMPLATE_WARNING}. MTOW 650 kg : EASA TCDS (P2008 JC), à confirmer ; bras, enveloppe et débits non sourcés (structure seulement).`,
    performance: {
      fuel: {
        type: 'UL91',
        densityKgPerL: 0.72,
        tanks: [
          {
            id: 'left',
            label: 'Réservoir gauche / Left tank',
            usableL: 49,
            unusableL: 1,
            armM: 0.45,
          },
          {
            id: 'right',
            label: 'Réservoir droit / Right tank',
            usableL: 49,
            unusableL: 1,
            armM: 0.45,
          },
        ],
        taxiFuelL: 2,
        burnOrder: [],
      },
      climb: {
        iasKt: 68,
        table: null,
        seaLevelRateFpm: 800,
        ceilingRateFpm: 100,
        fuelFlowLph: 24,
      },
      cruise: {
        normalSetting: '75%',
        rows: cruiseRows(
          [
            { name: '75%', tasAt0: 106, tasPer1000: 1.5, flowLph: 18 },
            { name: '65%', tasAt0: 98, tasPer1000: 1.4, flowLph: 15 },
          ],
          10000,
        ),
      },
      descent: { iasKt: 85, rateFpm: 500, fuelFlowLph: 10 },
      reserve: { holdingFuelFlowLph: 13, maxContinuousFuelFlowLph: 22 },
      arrivalFuelL: 0,
      serviceCeilingFt: 13000,
      calibration: [],
    },
    massBalance: {
      mtowKg: 650,
      mlwKg: 650,
      mzfwKg: null,
      stations: [
        { id: 'front', label: 'Sièges / Seats', kind: 'SEAT', armM: 0.6 },
        {
          id: 'baggage',
          label: 'Bagages / Baggage',
          kind: 'BAGGAGE',
          armM: 1.4,
          maxKg: 20,
        },
        {
          id: 'fuel-left',
          label: 'Carburant gauche / Left fuel',
          kind: 'FUEL',
          armM: 0.45,
          tankId: 'left',
        },
        {
          id: 'fuel-right',
          label: 'Carburant droit / Right fuel',
          kind: 'FUEL',
          armM: 0.45,
          tankId: 'right',
        },
      ],
      combinedLimits: [],
      envelopes: [
        envelope('NORMAL', [
          [0.3, 400],
          [0.3, 650],
          [0.55, 650],
          [0.55, 400],
        ]),
      ],
    },
  },
];

export const templateByCode = (code: string): AircraftTemplate | null =>
  AIRCRAFT_TEMPLATES.find((t) => t.code === code) ?? null;

// The template whose type matches a free-text model ("Robin DR400-140B").
export function templateForModel(
  model: string | null | undefined,
): AircraftTemplate | null {
  const text = (model ?? '').toUpperCase().replace(/[\s-]/g, '');
  const rules: [RegExp, string][] = [
    [/DR400\/?120|DR400120/, 'DR400-120'],
    [/DR400\/?140|DR400140/, 'DR400-140B'],
    [/DR400\/?160|DR400160/, 'DR400-160'],
    [/DR400\/?180|DR400180/, 'DR400-180'],
    [/C172S|172S|SKYHAWK/, 'C172S'],
    [/PA28161|WARRIOR|PA28/, 'PA28-161'],
    // The DA40 NG (diesel, Jet A-1) is another aircraft: no template.
    [/DA40(?!NG|TDI)/, 'DA40'],
    [/TB10|TOBAGO/, 'TB10'],
    [/P2008/, 'P2008JC'],
  ];
  const found = rules.find(([pattern]) => pattern.test(text));
  return found ? templateByCode(found[1]) : null;
}
