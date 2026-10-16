import {
  CruiseRow,
  Envelope,
  FuelTank,
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
// A template is never more permissive than the documents: a figure that was
// not read in a flight manual or a type certificate data sheet (cited with
// its page) is left empty, and the data cannot be confirmed until an
// administrator enters it. The C172S, PA28-161 and DA40 templates still
// carry figures marked "non sourcé" (not reviewed yet).

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

// Robin DR400 series. Masses, centre of gravity range, seat and baggage
// arms, baggage limit and fuel capacities: EASA TCDS EASA.A.367 issue 05
// (16 October 2023), one section per model (page numbers below). Datum: wing
// leading edge of the rectangular part of the wing. Forward limit 0.205 m at
// 750 kg rising linearly to 0.428 m at the maximum mass, aft limit 0.564 m
// at every mass (same figures in the DR 400/180 flight manual, p. 2.2).
// Performance figures are only given where a flight manual was read (the
// DR 400/180): elsewhere they are left empty and an administrator has to
// enter them from the aircraft's own manual before confirming.
const ROBIN_DATUM_NOTE =
  "Datum : bord d'attaque de la partie rectangulaire de l'aile";

const robinEnvelope = (
  category: Envelope['category'],
  maxKg: number,
): Envelope =>
  // The polygon is closed at 500 kg, below any empty mass: the manual's
  // limits apply at every mass (forward 0.205 m below 750 kg).
  envelope(category, [
    [0.205, 500],
    [0.205, 750],
    [0.428, maxKg],
    [0.564, maxKg],
    [0.564, 500],
  ]);

const robinStations = (baggageMaxKg: number): Station[] => [
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
    maxKg: baggageMaxKg,
  },
];

const fuelStations = (tanks: FuelTank[]): Station[] =>
  tanks.map((t) => ({
    id: `fuel-${t.id}`,
    label: t.label,
    kind: 'FUEL' as const,
    armM: t.armM,
    tankId: t.id,
  }));

// What a template leaves for the administrator: no figure rather than a
// plausible one. The data cannot be confirmed while any of it is missing
// (AircraftDataService.validate).
const EMPTY_CLIMB = {
  iasKt: 0,
  table: null,
  seaLevelRateFpm: null,
  ceilingRateFpm: null,
  fuelFlowLph: null,
};
const EMPTY_DESCENT = { iasKt: 0, rateFpm: 500, fuelFlowLph: 0 };
const EMPTY_RESERVE = { holdingFuelFlowLph: 0, maxContinuousFuelFlowLph: 0 };
// The taxi allowance is the club's (the editor's default), not a manual figure.
const TAXI_FUEL_L = 3;

// Main tank, 110 L: 100 L usable ("Standard 88"), 109 L from serial 2210
// ("Standard 92"); the lower figure is kept.
const ROBIN_MAIN_CAPACITY =
  'réservoir principal 110 L (100 L utilisables, 109 L sur les « Standard 92 » à partir du n° 2210)';

const robinWithoutManual = (options: {
  code: string;
  label: string;
  mtowKg: number;
  mlwKg: number;
  utilityMaxKg: number;
  baggageMaxKg: number;
  tanks?: FuelTank[];
  source: string;
}): AircraftTemplate => ({
  code: options.code,
  label: options.label,
  source: `${TEMPLATE_WARNING}. ${options.source}`,
  performance: {
    fuel: {
      type: 'AVGAS_100LL',
      densityKgPerL: 0.72,
      // Without a sourced arm, the tank is entered from the manual.
      tanks: options.tanks ?? [],
      taxiFuelL: TAXI_FUEL_L,
      burnOrder: [],
    },
    climb: EMPTY_CLIMB,
    cruise: { normalSetting: '', rows: [] },
    descent: EMPTY_DESCENT,
    reserve: EMPTY_RESERVE,
    arrivalFuelL: 0,
    serviceCeilingFt: null,
    calibration: [],
  },
  massBalance: {
    mtowKg: options.mtowKg,
    mlwKg: options.mlwKg,
    mzfwKg: null,
    stations: [
      ...robinStations(options.baggageMaxKg),
      ...fuelStations(options.tanks ?? []),
    ],
    combinedLimits: [],
    envelopes: [
      robinEnvelope('NORMAL', options.mtowKg),
      robinEnvelope('UTILITY', options.utilityMaxKg),
    ],
  },
});

// DR 400/180 flight manual (Robin, "Manuel de vol DR 400/180", editions
// 1972-1980): p. 1.6 and 2.5 fuel tanks; p. 2.2 masses and centre of
// gravity; p. 2.3 baggage placard 60 kg; p. 4.1 lever arms (front seats
// 0.41 m, rear bench 1.19 m, rear (main) fuel 1.12 m, front fuel 0.10 m,
// baggage 1.9 m); p. 4.1 bis loading example; p. 5.3 level flight
// performance at 1100 kg, ISA; p. 5.4 climb at 1100 kg; p. 7.6 optional
// auxiliary tank (50 L at 1.61 m, not in the template: optional).
const KM_H = 1 / 1.852;
const DR400_180_TANKS: FuelTank[] = [
  {
    id: 'main',
    label: 'Réservoir principal / Main tank',
    usableL: 100,
    unusableL: 10,
    armM: 1.12,
  },
  {
    id: 'front-right',
    label: 'Réservoir avant droit / Front right tank',
    usableL: 40,
    unusableL: 0,
    armM: 0.1,
  },
  {
    id: 'front-left',
    label: 'Réservoir avant gauche / Front left tank',
    usableL: 40,
    unusableL: 0,
    armM: 0.1,
  },
];
// p. 5.3: true airspeed (km/h) and fuel flow at 75 % and 60 % power. The
// 75 % line stops at 8000 ft (full throttle above).
const dr400180Cruise = (
  setting: string,
  flowLph: number,
  rows: [number, number][],
): CruiseRow[] =>
  rows.map(([pressureAltFt, kmh]) => ({
    pressureAltFt,
    setting,
    isaDeviationC: 0,
    tasKt: r(kmh * KM_H, 1),
    fuelFlowLph: flowLph,
  }));

const DR400_180: AircraftTemplate = {
  code: 'DR400-180',
  label: 'Robin DR400-180 (Régent)',
  source: `${TEMPLATE_WARNING}. Manuel de vol DR 400/180 (Robin) : masses et centrage p. 2.2, bagages p. 2.3, réservoirs p. 1.6 et 2.5, bras de levier p. 4.1, croisière p. 5.3 (75 % : 248 km/h, 39 L/h au niveau de la mer ; 60 % : 228 km/h, 32 L/h), montée p. 5.4 (4,2 m/s au sol, -0,24 m/s par 1000 ft, plafond 15 500 ft, 170 km/h) ; masses, centrage et réservoirs confirmés par l'EASA TCDS EASA.A.367 issue 05, section Z (p. 108-109). ${ROBIN_DATUM_NOTE}. ${ROBIN_MAIN_CAPACITY} + 2 réservoirs avant de 40 L ; réservoir supplémentaire optionnel 50 L à 1,61 m (p. 7.6) non inclus. Débit d'attente = croisière 60 % (GM2 NCO.OP.125, à défaut de donnée d'attente). Non donnés par le manuel, à saisir : débit en montée, vitesse et débit en descente, débit à la puissance maximale continue.`,
  performance: {
    fuel: {
      type: 'AVGAS_100LL',
      densityKgPerL: 0.72,
      tanks: DR400_180_TANKS,
      taxiFuelL: TAXI_FUEL_L,
      burnOrder: [],
    },
    climb: {
      // p. 5.4: 170 km/h, 4.2 m/s at sea level, 0.48 m/s at 15 500 ft.
      iasKt: 92,
      table: null,
      seaLevelRateFpm: 827,
      ceilingRateFpm: 94,
      fuelFlowLph: null,
    },
    cruise: {
      normalSetting: '75%',
      rows: [
        ...dr400180Cruise('75%', 39, [
          [0, 248],
          [4000, 257],
          [8000, 267],
        ]),
        ...dr400180Cruise('60%', 32, [
          [0, 228],
          [4000, 235],
          [8000, 242],
          [12000, 249],
        ]),
      ],
    },
    descent: EMPTY_DESCENT,
    reserve: { holdingFuelFlowLph: 32, maxContinuousFuelFlowLph: 0 },
    arrivalFuelL: 0,
    serviceCeilingFt: 15500,
    calibration: [],
  },
  massBalance: {
    mtowKg: 1100,
    mlwKg: 1045,
    mzfwKg: null,
    stations: [...robinStations(60), ...fuelStations(DR400_180_TANKS)],
    combinedLimits: [],
    envelopes: [robinEnvelope('NORMAL', 1100), robinEnvelope('UTILITY', 950)],
  },
};

const emptyTemplate = (options: {
  code: string;
  label: string;
  fuel: PerformanceData['fuel']['type'];
  source: string;
}): AircraftTemplate => ({
  code: options.code,
  label: options.label,
  source: `${TEMPLATE_WARNING}. ${options.source}`,
  performance: {
    fuel: {
      type: options.fuel,
      densityKgPerL: 0.72,
      tanks: [],
      taxiFuelL: TAXI_FUEL_L,
      burnOrder: [],
    },
    climb: EMPTY_CLIMB,
    cruise: { normalSetting: '', rows: [] },
    descent: EMPTY_DESCENT,
    reserve: EMPTY_RESERVE,
    arrivalFuelL: 0,
    serviceCeilingFt: null,
    calibration: [],
  },
  massBalance: {
    mtowKg: null,
    mlwKg: null,
    mzfwKg: null,
    stations: [],
    combinedLimits: [],
    envelopes: [],
  },
});

export const AIRCRAFT_TEMPLATES: AircraftTemplate[] = [
  robinWithoutManual({
    code: 'DR400-120',
    label: 'Robin DR400-120 (Dauphin 2+2)',
    mtowKg: 900,
    mlwKg: 900,
    utilityMaxKg: 900,
    baggageMaxKg: 40,
    source: `EASA TCDS EASA.A.367 issue 05, section CC : réservoirs p. 121, masses, centrage, sièges et bagages (40 kg) p. 122 (catégories N et U identiques). ${ROBIN_DATUM_NOTE}. ${ROBIN_MAIN_CAPACITY}, bras à relever dans le manuel ; réservoir supplémentaire optionnel 50 L. Performances non sourcées : à saisir depuis le manuel de vol de l'avion.`,
  }),
  robinWithoutManual({
    code: 'DR400-140B',
    label: 'Robin DR400-140B (Major)',
    mtowKg: 1000,
    mlwKg: 1000,
    utilityMaxKg: 910,
    baggageMaxKg: 40,
    source: `EASA TCDS EASA.A.367 issue 05, section EE : réservoirs, masses et centrage p. 130, sièges et bagages (40 kg) p. 131. ${ROBIN_DATUM_NOTE}. ${ROBIN_MAIN_CAPACITY}, bras à relever dans le manuel ; réservoir supplémentaire optionnel 50 L. Performances non sourcées : à saisir depuis le manuel de vol de l'avion.`,
  }),
  // The DR 400/160 is the DR 400/180 airframe with another engine (TCDS
  // section Z note 1): same tanks and arms; no manual read for its
  // performance.
  robinWithoutManual({
    code: 'DR400-160',
    label: 'Robin DR400-160 (Chevalier)',
    mtowKg: 1050,
    mlwKg: 1045,
    utilityMaxKg: 950,
    baggageMaxKg: 40,
    tanks: DR400_180_TANKS,
    source: `EASA TCDS EASA.A.367 issue 05, section Y : réservoirs p. 103, masses et centrage p. 104, sièges et bagages (40 kg) p. 105 ; bras des réservoirs : manuel DR 400/180 p. 4.1 (cellule identique, TCDS section Z note 1). ${ROBIN_DATUM_NOTE}. ${ROBIN_MAIN_CAPACITY} + 2 réservoirs avant de 40 L ; réservoir supplémentaire optionnel 50 L non inclus. Performances (croisière, montée, descente, débits) non sourcées : à saisir depuis le manuel de vol de l'avion.`,
  }),
  DR400_180,
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
  // No document read for these two types: the template only names the type
  // and its fuel; every figure is entered from the aircraft's own manual.
  emptyTemplate({
    code: 'TB10',
    label: 'Socata TB10 Tobago',
    fuel: 'AVGAS_100LL',
    source:
      "Aucune donnée sourcée : masses, enveloppe de centrage, stations de chargement, réservoirs et performances sont à saisir depuis le manuel de vol et la fiche de pesée de l'avion.",
  }),
  emptyTemplate({
    code: 'P2008JC',
    label: 'Tecnam P2008 JC',
    fuel: 'UL91',
    source:
      "Aucune donnée sourcée : masses, enveloppe de centrage, stations de chargement, réservoirs et performances sont à saisir depuis le manuel de vol et la fiche de pesée de l'avion.",
  }),
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
