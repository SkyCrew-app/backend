import { direct, METRES_PER_NM } from '../../navplan/engine/geodesy';
import {
  AirspaceType,
  AltitudeLimit,
  isAirbandVhf,
  RadioFrequency,
} from '../../navplan/engine/airspace-intersection';
import {
  BundleAerodromeInfo,
  BundleAirspace,
  BundleObstacle,
  BundlePoint,
  BundleRunway,
  BundleRunwayEnd,
  bump,
  ImportReport,
  UNKNOWN_OUTLINE_COUNT,
} from './bundle-types';
import { siaInLanguage, siaText } from './sia-text';
import { child, childText, walkXml, XmlElement } from './xml';

// Reads the SIA "XML SIA" export (file XML_SIA_yyyy-mm-dd.xml of the zip
// «Données aéronautiques XML AIRAC nn/aa», Licence Ouverte of the SIA).
//
// Layout (SiaExport version 5, ISO-8859-1): SiaExport > Situation[effDate] >
// one list per table (AdS, RwyS, ServiceS, FrequenceS, NavFixS, RadioNavS,
// EspaceS, PartieS, VolumeS...), records linked by `pk` attributes:
//   Espace (TypeEspace, Nom) <- Partie (Espace@pk, NomPartie, NomUsuel,
//   Contour = encoded outline, Geometrie = the same outline already
//   densified as "lat,lon" lines) <- Volume (Partie@pk, Classe, Plancher /
//   PlancherRefUnite, Plafond / PlafondRefUnite with units SFC, "ft ASFC",
//   "ft AMSL", FL, UNL; HorCode, HorTxt, Activite, Remarque).
//   Ad (Territoire@lk "[LF]", AdCode "PN" -> LFPN, ArpLat, ArpLong,
//   AdRefAltFt, AdNomComplet, AdStatut) <- Rwy (Ad@pk), Service (Ad@pk or
//   Espace@pk, Service = TWR/APP/AFIS/A/A/ATIS/FIS..., IndicService) <-
//   Frequence (Service@pk, Frequence MHz).
//   NavFix (NavType VOR, VOR-DME, VORTAC, NDB, DME-ATT, TACAN, VFR, WPT...,
//   Ident, Latitude, Longitude, Description) <- RadioNav (NavFix@pk,
//   Frequence, Station). VFR reporting points are NavFix VFR whose Ident is
//   "<last two letters of the aerodrome>-<name>", e.g. "PN-N".
// The densified Geometrie is used: arcs and borders are already drawn by
// the SIA. Checked against the published structure of the file as read by
// open-source readers of it (AIPP region LF, sia-aero, archive.aero), see
// the import report for what is skipped.
// Contour lines are "<seq>,Cloture=<id>,<lat lon of the start>,<segment>
// (<args>)[TAB<flag>[TAB<text>]]", segment grc (great circle), rhl (rhumb
// line), cwa / cca (arcs), cir (circle), fnt (along a Bordure). Checked on
// the AIRAC 2310 export (2023-10-05):
// - a part made of several closed rings (islets) keeps only the last one in
//   its Geometrie: the rings are rebuilt from the Contour when it has only
//   straight segments;
// - protected areas (PRN), D 595, R 1 (NW) and part 2 of LTA FRANCE are
//   published as a single point, or a point and a text: the same in the
//   AIXM 4.5 file of the same zip. Their outline is unknown: they are kept
//   with an empty geometry and their point (none when a text defines the
//   part), never drawn as a small circle, and listed in the plans near
//   them (see unverifiedAirspaces in airspace-intersection.ts).

const AIRSPACE_TYPES: Record<string, AirspaceType[]> = {
  P: ['P'],
  ZIT: ['P'],
  R: ['R'],
  ZRT: ['R'],
  D: ['D'],
  ZDT: ['D'],
  CTR: ['CTR'],
  TMA: ['TMA'],
  CTA: ['CTA'],
  LTA: ['CTA'],
  SIV: ['SIV'],
  RMZ: ['RMZ'],
  TMZ: ['TMZ'],
  'RMZ-TMZ': ['RMZ', 'TMZ'],
  TRA: ['TRA'],
  TSA: ['TSA'],
  PRN: ['PROTECTED'],
  // Activities published at a point (ENR 5.5 / 5.7), checked against the
  // AIRAC 2610 records: Pje "parachutage", Vol "voltige", TrPla / TrVL /
  // TrPVL "treuillage planeurs / vol libre / parachutisme ascensionnel",
  // Aer "vols radiocommandés", Bal "ballon captif", AP "aéronefs sans
  // équipage à bord", SUR "survols interdits à basse altitude, 1000 ft MNM
  // monomoteurs à piston" (sites the law protects, see PRN). FBZ (flight
  // planning buffer zones, FL195 and above) stays out.
  Pje: ['PARACHUTING'],
  Vol: ['AEROBATICS'],
  TrPla: ['WINCH'],
  TrVL: ['WINCH'],
  TrPVL: ['WINCH'],
  Aer: ['MODEL_AIRCRAFT'],
  Bal: ['BALLOON'],
  AP: ['DRONE'],
  SUR: ['LOW_OVERFLIGHT'],
};

const ACTIVITY_TYPES = new Set<AirspaceType>([
  'PARACHUTING',
  'AEROBATICS',
  'WINCH',
  'MODEL_AIRCRAFT',
  'BALLOON',
  'DRONE',
  'LOW_OVERFLIGHT',
]);

const NAVAID_TYPES: Record<string, BundlePoint['type']> = {
  VOR: 'VOR',
  'VOR-DME': 'VOR_DME',
  VORTAC: 'VOR_DME',
  NDB: 'NDB',
  'DME-ATT': 'DME',
  DME: 'DME',
  TACAN: 'TACAN',
};

const CIRCLE_POINTS = 72;
// A text this long after the point of a Contour defines the part in words:
// the point is then only an anchor, not a position of the area.
const TEXT_DEFINITION_MIN_LENGTH = 20;

export interface SiaParseResult {
  effectiveDate: string | null;
  version: string | null;
  points: BundlePoint[];
  airspaces: BundleAirspace[];
  obstacles: BundleObstacle[];
}

const ref = (element: XmlElement, name: string): string | null =>
  child(element, name)?.attributes.pk ?? null;

const territoryCode = (element: XmlElement): string | null => {
  const lk = child(element, 'Territoire')?.attributes.lk ?? '';
  return /^\[([A-Z]{2})\]/.exec(lk)?.[1] ?? null;
};

const number = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

export function parseAltitude(
  value: string | null,
  unit: string | null,
): AltitudeLimit | null {
  const u = (unit ?? '').trim();
  const v = number(value) ?? 0;
  switch (u) {
    case 'SFC':
      return { ref: 'SFC', value: 0 };
    case 'UNL':
      return { ref: 'FL', value: 999 };
    case 'ft ASFC':
      return v === 0
        ? { ref: 'SFC', value: 0 }
        : { ref: 'AGL', value: Math.round(v) };
    case 'ft AMSL':
      return { ref: 'AMSL', value: Math.round(v) };
    case 'FL':
      return { ref: 'FL', value: Math.round(v) };
    default:
      return null;
  }
}

const parseGeometrie = (text: string | null): number[][] => {
  if (!text) return [];
  const ring: number[][] = [];
  for (const line of text.split(/\r?\n/)) {
    const [lat, lon] = line.trim().split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    // A segment ending where a border starts repeats the point (TMA BALE
    // 09, 10 and deleg.LANGEN S-E in AIRAC 2310): one is kept.
    const last = ring[ring.length - 1];
    if (last && last[0] === lon && last[1] === lat) continue;
    ring.push([lon, lat]);
  }
  return ring;
};

const circle = (lat: number, lon: number, radiusNm: number): number[][] => {
  const ring: number[][] = [];
  for (let i = 0; i < CIRCLE_POINTS; i++) {
    const p = direct(
      { lat, lon },
      (360 * i) / CIRCLE_POINTS,
      radiusNm * METRES_PER_NM,
    );
    ring.push([p.lon, p.lat]);
  }
  ring.push(ring[0]);
  return ring;
};

// "cir(48.5 2.3:2.5:NM:...)" in an encoded Contour.
const circleOfContour = (
  contour: string | null,
): { lat: number; lon: number; radiusNm: number } | null => {
  const match =
    /cir\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*:\s*([\d.]+)\s*:\s*(nm|NM|km|KM|m|M)/.exec(
      contour ?? '',
    );
  if (!match) return null;
  const value = Number(match[3]);
  const unit = match[4].toLowerCase();
  const radiusNm =
    unit === 'nm'
      ? value
      : unit === 'km'
        ? (value * 1000) / METRES_PER_NM
        : value / METRES_PER_NM;
  return { lat: Number(match[1]), lon: Number(match[2]), radiusNm };
};

interface ContourSegment {
  lat: number;
  lon: number;
  kind: string;
  text: string;
}

const contourSegments = (contour: string | null): ContourSegment[] => {
  const segments: ContourSegment[] = [];
  for (const line of (contour ?? '').split(/\r?\n/)) {
    const match =
      /^\s*\d+,Cloture=\d+,(-?[\d.]+) (-?[\d.]+),([a-z]{3})\([^)]*\)(.*)$/.exec(
        line,
      );
    if (!match) continue;
    segments.push({
      lat: Number(match[1]),
      lon: Number(match[2]),
      kind: match[3],
      text: (match[4].split('\t')[2] ?? '').trim(),
    });
  }
  return segments;
};

// Closed rings of a Contour made of straight segments only; a ring closes
// when a segment starts back on its first point.
const straightContourRings = (segments: ContourSegment[]): number[][][] => {
  if (segments.some((s) => s.kind !== 'grc' && s.kind !== 'rhl')) return [];
  const rings: number[][][] = [];
  let ring: number[][] = [];
  for (const segment of segments) {
    const point = [segment.lon, segment.lat];
    if (
      ring.length >= 3 &&
      ring[0][0] === point[0] &&
      ring[0][1] === point[1]
    ) {
      rings.push([...ring, ring[0]]);
      ring = [];
      continue;
    }
    ring.push(point);
  }
  return rings;
};

const closeRing = (ring: number[][]): number[][] => {
  if (ring.length === 0) return ring;
  const [first, last] = [ring[0], ring[ring.length - 1]];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
};

const yesNo = (value: string | null): boolean | null =>
  value === 'oui' ? true : value === 'non' ? false : null;

// The grades named in SvcEscaleFuel (French part): "Carburants : 100 LL -
// JET A1 - JET SAF - UL AERO SUPER +" at LFPN, "UL91 - JET A1" at LFRS,
// "NIL" where there is none. F18 / F34 / F35 are the military grades.
const FUEL_GRADES: [RegExp, string][] = [
  [/100\s*LL/i, '100LL'],
  [/UL\s*91/i, 'UL91'],
  [/UL\s*AERO\s*SUPER\s*\+?/i, 'UL AERO SUPER+'],
  [/JET\s*A-?1/i, 'JET A1'],
  [/JET\s*SAF/i, 'JET SAF'],
  [/MOGAS|SP\s*98/i, 'MOGAS'],
  [/\bTR0\b|\bTRO\b/, 'TR0'],
  [/\bF\s?18\b/, 'F18'],
  [/\bF\s?34\b/, 'F34'],
  [/\bF\s?35\b/, 'F35'],
];

export function fuelGrades(text: string | null): string[] {
  const french = siaInLanguage(text, 'fr');
  if (!french) return [];
  const grades = FUEL_GRADES.filter(([pattern]) => pattern.test(french)).map(
    ([, grade]) => grade,
  );
  // "AVGAS" alone is 100LL in France; with 100LL it is the same grade.
  if (/AVGAS/i.test(french) && !grades.includes('100LL'))
    grades.unshift('100LL');
  return grades;
}

// The SIA codes ground and delivery as TWR "Sol" / "Prévol" (LFBO): named
// as a pilot calls them.
const serviceOf = (code: string, indic: string | null): string => {
  if (code !== 'TWR') return code;
  if (/^(Sol|Ground)$/i.test(indic ?? '')) return 'GND';
  if (/^(Prévol|Prevol|Delivery)$/i.test(indic ?? '')) return 'DEL';
  return code;
};

// Runway "07R/25L": end 1 is 07R (threshold 1, Lda1...), end 2 is 25L.
function runwayEnds(rwy: XmlElement): BundleRunwayEnd[] {
  const designators = (childText(rwy, 'Rwy') ?? '').split('/');
  const bearing = number(childText(rwy, 'OrientationGeo'));
  return designators.slice(0, 2).map((designator, i) => {
    const n = i + 1;
    return {
      designator: designator.trim(),
      trueBearingDeg:
        bearing === null
          ? null
          : Math.round(((bearing + i * 180) % 360) * 100) / 100,
      magneticBearingDeg: null,
      toraM: null,
      todaM: null,
      asdaM: null,
      ldaM: number(childText(rwy, `Lda${n}`)),
      thresholdElevationFt: number(childText(rwy, `AltFtThr${n}`)),
      displacedThreshold: childText(rwy, `LatDThr${n}`) !== null,
      remarks: childText(rwy, `RemDecDist${n}`),
    };
  });
}

function aerodromeInfo(ad: XmlElement): BundleAerodromeInfo {
  const fuel = childText(ad, 'SvcEscaleFuel');
  return {
    status: childText(ad, 'AdStatut'),
    vfr: yesNo(childText(ad, 'TfcVfr')),
    ifr: yesNo(childText(ad, 'TfcIfr')),
    privateFlights: yesNo(childText(ad, 'TfcPrive')),
    magneticVariationDeg: number(childText(ad, 'AdMagVar')),
    magneticVariationYear: childText(ad, 'MagVarDate'),
    atsHoursCode: childText(ad, 'HorAtsCode'),
    atsHours: childText(ad, 'HorAtsTxt'),
    fuelHours: childText(ad, 'HorAvtTxt'),
    fuel,
    fuelRemarks: childText(ad, 'SvcEscaleFuelRem'),
    fuelTypes: fuelGrades(fuel),
    remarks: childText(ad, 'AdRem'),
    phone: childText(ad, 'AdTel'),
    operator: childText(ad, 'AdGestion'),
    ad2: childText(ad, 'AdAd2') === 'oui',
  };
}

const mandatoryOf = (description: string | null): boolean | null => {
  if (!description) return null;
  if (/obligatoire|compulsory|mandatory/i.test(description)) return true;
  if (/sur demande|on request|facultatif/i.test(description)) return false;
  return null;
};

export function parseSiaXml(xml: string, report: ImportReport): SiaParseResult {
  const tables: Record<string, XmlElement[]> = {};
  let effectiveDate: string | null = null;
  let version: string | null = null;
  walkXml(
    xml,
    3,
    (element, path) => {
      const table = path[2];
      (tables[table] ??= []).push(element);
    },
    (name, attributes, depth) => {
      if (depth === 0 && name === 'SiaExport')
        version = attributes.Version ?? null;
      if (depth <= 1 && attributes.effDate) effectiveDate = attributes.effDate;
    },
  );
  if (version !== null && version !== '5') {
    report.warnings.push(
      `SiaExport version ${version}, the reader was written for version 5`,
    );
  }
  const list = (table: string) => tables[table] ?? [];

  // Services and their frequencies.
  // Auxiliary frequencies (Suppletive), military UHF ones and the emergency
  // one (TMA EVREUX: 362.300, 243.000, 121.500 first) come after the main
  // VHF ones: the first frequency of a service is the one a plan names.
  // Hours and remarks are kept: at LFOP, A/A 120.200 (HX, "Absence ATS")
  // and TWR 120.200 (HO) are told apart only by them.
  const frequenciesByService = new Map<
    string,
    {
      mhz: string;
      auxiliary: boolean;
      hoursCode: string | null;
      hours: string | null;
      remark: string | null;
    }[]
  >();
  for (const frequency of list('FrequenceS')) {
    const service = ref(frequency, 'Service');
    const mhz = childText(frequency, 'Frequence');
    if (!service || !mhz) continue;
    const values = frequenciesByService.get(service) ?? [];
    values.push({
      mhz: Number(mhz).toFixed(3),
      auxiliary: childText(frequency, 'Suppletive') === 'oui',
      hoursCode: childText(frequency, 'HorCode'),
      hours: siaText(childText(frequency, 'HorTxt')),
      remark: siaText(childText(frequency, 'Remarque')),
    });
    frequenciesByService.set(service, values);
  }
  // The aerodrome of a CTR (Espace/AdAssocie): the tower of LFBO is
  // published on the CTR BLAGNAC only.
  const adOfEspace = new Map<string, string>();
  for (const espace of list('EspaceS')) {
    const ad = ref(espace, 'AdAssocie');
    if (ad) adOfEspace.set(espace.attributes.pk, ad);
  }
  // A service names its aerodrome, its airspace, or both (APP ORLY: LFPO
  // and CTR PARIS; TWR AGEN: LFBA and CTR AGEN LA GARENNE): it belongs to
  // each. Aerodromes and airspaces are numbered apart (Ad pk 36 and Espace
  // pk 36 both exist), hence one map each.
  const radioByAd = new Map<string, RadioFrequency[]>();
  const radioByEspace = new Map<string, RadioFrequency[]>();
  for (const service of list('ServiceS')) {
    const espace = ref(service, 'Espace');
    const ad = ref(service, 'Ad') ?? (espace ? adOfEspace.get(espace) : null);
    if (!ad && !espace) continue;
    const code = childText(service, 'Service') ?? '';
    const indic = childText(service, 'IndicService');
    const place = childText(service, 'IndicLieu');
    // lk "[LF][OT][TWR TOURS Tour]": the third part is the service and
    // its call sign.
    const lkName =
      /\]\[[^\]]*\]\[([^\]]+)\]$/.exec(service.attributes.lk ?? '')?.[1] ?? '';
    const fromLk = (
      code && lkName.startsWith(code) ? lkName.slice(code.length) : lkName
    ).trim();
    const callsign =
      [place, indic].filter((v) => v && v !== '.').join(' ') || fromLk || null;
    const frequencies = [
      ...(frequenciesByService.get(service.attributes.pk) ?? []),
    ]
      .sort(
        (a, b) =>
          Number(!isAirbandVhf(a.mhz)) - Number(!isAirbandVhf(b.mhz)) ||
          Number(a.auxiliary) - Number(b.auxiliary),
      )
      .map(({ mhz, auxiliary, hoursCode, hours, remark }) => ({
        service: serviceOf(code, indic),
        callsign,
        mhz,
        hoursCode,
        hours,
        remark,
        auxiliary,
      }));
    if (frequencies.length === 0) continue;
    for (const [owners, owner] of [
      [radioByAd, ad],
      [radioByEspace, espace],
    ] as const) {
      if (owner)
        owners.set(owner, [...(owners.get(owner) ?? []), ...frequencies]);
    }
  }

  // Aerodromes.
  const runwaysByAd = new Map<string, BundleRunway[]>();
  for (const rwy of list('RwyS')) {
    const ad = ref(rwy, 'Ad');
    if (!ad) continue;
    const runways = runwaysByAd.get(ad) ?? [];
    runways.push({
      designator: childText(rwy, 'Rwy') ?? '?',
      trueHeadingDeg: number(childText(rwy, 'OrientationGeo')),
      lengthM: number(childText(rwy, 'Longueur')),
      widthM: number(childText(rwy, 'Largeur')),
      surface: childText(rwy, 'Revetement'),
      main: childText(rwy, 'Principale') === 'oui',
      ends: runwayEnds(rwy),
    });
    runwaysByAd.set(ad, runways);
  }
  const points: BundlePoint[] = [];
  const icaoByAdPk = new Map<string, string>();
  for (const ad of list('AdS')) {
    const territory = territoryCode(ad);
    const code = childText(ad, 'AdCode');
    const lat = number(childText(ad, 'ArpLat'));
    const lon = number(childText(ad, 'ArpLong'));
    if (!territory || !code || lat === null || lon === null) {
      bump(report.skipped, 'aerodrome without code or position');
      continue;
    }
    // The SIA gives the last two letters (PN); a full code (LFPN) is kept.
    const icao = /^[A-Z]{2}$/.test(code) ? `${territory}${code}` : code;
    icaoByAdPk.set(ad.attributes.pk, icao);
    points.push({
      type: 'AERODROME',
      ident: icao,
      name: childText(ad, 'AdNomComplet') ?? childText(ad, 'AdNomCarto'),
      lat,
      lon,
      elevationFt: number(childText(ad, 'AdRefAltFt')),
      frequency: null,
      country: 'FR',
      aerodromeIcao: null,
      mandatory: null,
      source: 'SIA',
      sourceId: ad.attributes.pk ?? null,
      extra: {
        runways: runwaysByAd.get(ad.attributes.pk) ?? [],
        // Once each: the tower of a CTR may also be on its aerodrome.
        frequencies: (radioByAd.get(ad.attributes.pk) ?? []).filter(
          (f, i, all) =>
            all.findIndex((g) => g.service === f.service && g.mhz === f.mhz) ===
            i,
        ),
        status: childText(ad, 'AdStatut'),
        info: aerodromeInfo(ad),
      },
    });
    bump(report.counts, 'AERODROME');
  }

  // Navaids and VFR reporting points.
  const radioNavByFix = new Map<string, XmlElement>();
  for (const radioNav of list('RadioNavS')) {
    const fix = ref(radioNav, 'NavFix');
    if (fix) radioNavByFix.set(fix, radioNav);
  }
  for (const fix of list('NavFixS')) {
    const navType = childText(fix, 'NavType') ?? '';
    const ident = childText(fix, 'Ident');
    const lat = number(childText(fix, 'Latitude'));
    const lon = number(childText(fix, 'Longitude'));
    if (!ident || lat === null || lon === null) {
      bump(report.skipped, `NavFix ${navType} without ident or position`);
      continue;
    }
    const territory = territoryCode(fix) ?? 'LF';
    const description = childText(fix, 'Description');
    if (navType === 'VFR') {
      const [adCode, ...rest] = ident.split('-');
      const name = rest.join('-') || ident;
      points.push({
        type: 'VRP',
        ident: name,
        name: description ? `${name} - ${description}` : name,
        lat,
        lon,
        elevationFt: null,
        frequency: null,
        country: 'FR',
        aerodromeIcao: rest.length ? `${territory}${adCode}` : null,
        mandatory: mandatoryOf(description),
        source: 'SIA',
        sourceId: fix.attributes.pk ?? null,
        extra: { description },
      });
      bump(report.counts, 'VRP');
      continue;
    }
    const type = NAVAID_TYPES[navType];
    if (!type) {
      bump(report.skipped, `NavFix ${navType || '?'}`);
      continue;
    }
    const radioNav = radioNavByFix.get(fix.attributes.pk);
    if (!radioNav) {
      bump(report.skipped, `${navType} without RadioNav`);
      continue;
    }
    const frequency = childText(radioNav, 'Frequence');
    points.push({
      type,
      ident,
      name: childText(radioNav, 'Station') ?? childText(radioNav, 'NomPhraseo'),
      lat,
      lon,
      elevationFt: number(childText(radioNav, 'AltitudeFt')),
      frequency: frequency
        ? type === 'NDB'
          ? String(Number(frequency))
          : Number(frequency).toFixed(2)
        : null,
      country: 'FR',
      aerodromeIcao: null,
      mandatory: null,
      source: 'SIA',
      sourceId: fix.attributes.pk ?? null,
      extra: null,
    });
    bump(report.counts, type);
  }

  // Airspaces: one record per volume, with the outline of its part.
  const espaces = new Map(list('EspaceS').map((e) => [e.attributes.pk, e]));
  const parties = new Map(list('PartieS').map((p) => [p.attributes.pk, p]));
  const airspaces: BundleAirspace[] = [];
  let unknownOutlines = 0;
  for (const volume of list('VolumeS')) {
    const partie = parties.get(ref(volume, 'Partie') ?? '');
    const espace = partie
      ? espaces.get(ref(partie, 'Espace') ?? '')
      : undefined;
    if (!partie || !espace) {
      bump(report.skipped, 'volume without part or space');
      continue;
    }
    const typeEspace = childText(espace, 'TypeEspace') ?? '';
    const types = AIRSPACE_TYPES[typeEspace];
    if (!types) {
      bump(report.skipped, `airspace type ${typeEspace || '?'}`);
      continue;
    }
    const floor = parseAltitude(
      childText(volume, 'Plancher'),
      childText(volume, 'PlancherRefUnite'),
    );
    const ceiling = parseAltitude(
      childText(volume, 'Plafond'),
      childText(volume, 'PlafondRefUnite'),
    );
    const spaceName = `${typeEspace} ${childText(espace, 'Nom') ?? ''}`.trim();
    if (!floor || !ceiling) {
      report.errors.push(
        `${spaceName}: unknown altitude reference (${childText(volume, 'PlancherRefUnite')} / ${childText(volume, 'PlafondRefUnite')})`,
      );
      continue;
    }
    const segments = contourSegments(childText(partie, 'Contour'));
    let geometry: number[][][][] = [];
    let referencePoint: BundleAirspace['referencePoint'] = null;
    const contourRings = straightContourRings(segments);
    const ring = closeRing(parseGeometrie(childText(partie, 'Geometrie')));
    const circleSpec = circleOfContour(childText(partie, 'Contour'));
    if (contourRings.length > 1) {
      geometry = contourRings.map((r) => [r]);
    } else if (ring.length >= 4) {
      geometry = [[ring]];
    } else if (circleSpec) {
      geometry = [
        [circle(circleSpec.lat, circleSpec.lon, circleSpec.radiusNm)],
      ];
    } else {
      const anchor =
        ring[0] ?? (segments[0] && [segments[0].lon, segments[0].lat]);
      const definedInWords = segments.some(
        (s) => s.text.length >= TEXT_DEFINITION_MIN_LENGTH,
      );
      // An activity is at its point whatever text comes with it ("Axe RWY
      // 08/26" for Vol 6105).
      referencePoint =
        anchor && (!definedInWords || types.some((t) => ACTIVITY_TYPES.has(t)))
          ? { lat: anchor[1], lon: anchor[0] }
          : null;
    }
    const partName = childText(partie, 'NomPartie');
    const usualName = childText(partie, 'NomUsuel');
    const name = [
      spaceName,
      partName && partName !== '.' ? partName : null,
      usualName,
    ]
      .filter(Boolean)
      .join(' ');
    const alternatives = [
      childText(volume, 'Plancher2')
        ? `Plancher / floor: ${childText(volume, 'Plancher2')} ft ASFC`
        : null,
      childText(volume, 'Plafond2')
        ? `Plafond / ceiling: ${childText(volume, 'Plafond2')} ft ASFC`
        : null,
    ].filter(Boolean);
    const remarks = siaText(
      [childText(volume, 'Remarque'), ...alternatives]
        .filter(Boolean)
        .join('\n'),
    );
    const scheduleCode = childText(volume, 'HorCode');
    // Activity and hours apart: 1196 volumes have both.
    const activity = siaText(childText(volume, 'Activite'));
    const hours = siaText(
      childText(volume, 'HorTxt') ?? (scheduleCode === 'H24' ? 'H24' : null),
    );
    for (const type of types) {
      airspaces.push({
        sourceId: `${espace.attributes.pk}/${partie.attributes.pk}/${volume.attributes.pk}${types.length > 1 ? `/${type}` : ''}`,
        name,
        type,
        icaoClass: childText(volume, 'Classe'),
        floor,
        ceiling,
        activity,
        hours,
        scheduleCode,
        frequencies: radioByEspace.get(espace.attributes.pk) ?? [],
        remarks: remarks || null,
        geometry,
        referencePoint,
      });
      bump(report.counts, `airspace ${type}`);
      // Activities at a point are expected without an outline.
      if (geometry.length === 0 && !ACTIVITY_TYPES.has(type)) {
        unknownOutlines++;
        report.warnings.push(
          referencePoint
            ? `${name}: géométrie inconnue / unknown outline (published as the point ${referencePoint.lat} ${referencePoint.lon} only), listed in the plans near it`
            : `${name}: géométrie inconnue / unknown outline and position, listed in every plan that reaches its levels`,
        );
      }
    }
  }

  if (unknownOutlines > 0) {
    report.counts[UNKNOWN_OUTLINE_COUNT] = unknownOutlines;
    report.warnings.push(
      `Géométrie inconnue / unknown outline: ${unknownOutlines} airspace(s) of ${airspaces.length}, not drawn, flagged in the plans`,
    );
  }

  // Obstacles of metropolitan France (the territories overseas are out of
  // the planner's reach).
  const obstacles: BundleObstacle[] = [];
  for (const obstacle of list('ObstacleS')) {
    if (territoryCode(obstacle) !== 'LF') continue;
    const lat = number(childText(obstacle, 'Latitude'));
    const lon = number(childText(obstacle, 'Longitude'));
    const amslFt = number(childText(obstacle, 'AmslFt'));
    if (lat === null || lon === null || amslFt === null) {
      bump(report.skipped, 'obstacle without position or height');
      continue;
    }
    obstacles.push({
      ident: childText(obstacle, 'NumeroNom') ?? obstacle.attributes.pk,
      type: childText(obstacle, 'TypeObst') ?? '?',
      lat,
      lon,
      amslFt,
      aglFt: number(childText(obstacle, 'AglFt')),
      count: number(childText(obstacle, 'Combien')) ?? 1,
      lighting: childText(obstacle, 'Balisage'),
      remark: siaText(childText(obstacle, 'Remarque')),
    });
  }
  if (obstacles.length) report.counts.obstacles = obstacles.length;

  return { effectiveDate, version, points, airspaces, obstacles };
}
