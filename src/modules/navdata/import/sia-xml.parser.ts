import { direct, METRES_PER_NM } from '../../navplan/engine/geodesy';
import {
  AirspaceType,
  AltitudeLimit,
  RadioFrequency,
} from '../../navplan/engine/airspace-intersection';
import {
  BundleAirspace,
  BundlePoint,
  BundleRunway,
  bump,
  ImportReport,
} from './bundle-types';
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
};

const NAVAID_TYPES: Record<string, BundlePoint['type']> = {
  VOR: 'VOR',
  'VOR-DME': 'VOR_DME',
  VORTAC: 'VOR_DME',
  NDB: 'NDB',
  'DME-ATT': 'DME',
  DME: 'DME',
  TACAN: 'TACAN',
};

// Radius of a zone published as a single point without radius.
const POINT_ZONE_RADIUS_NM = 0.54; // 1 km
const CIRCLE_POINTS = 72;

export interface SiaParseResult {
  effectiveDate: string | null;
  version: string | null;
  points: BundlePoint[];
  airspaces: BundleAirspace[];
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
    if (Number.isFinite(lat) && Number.isFinite(lon)) ring.push([lon, lat]);
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

const closeRing = (ring: number[][]): number[][] => {
  if (ring.length === 0) return ring;
  const [first, last] = [ring[0], ring[ring.length - 1]];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
};

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
  const frequenciesByService = new Map<string, string[]>();
  for (const frequency of list('FrequenceS')) {
    const service = ref(frequency, 'Service');
    const mhz = childText(frequency, 'Frequence');
    if (!service || !mhz) continue;
    const values = frequenciesByService.get(service) ?? [];
    values.push(Number(mhz).toFixed(3));
    frequenciesByService.set(service, values);
  }
  const radioByOwner = new Map<string, RadioFrequency[]>();
  for (const service of list('ServiceS')) {
    const owner = ref(service, 'Ad') ?? ref(service, 'Espace');
    if (!owner) continue;
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
    const frequencies = (
      frequenciesByService.get(service.attributes.pk) ?? []
    ).map((mhz) => ({
      service: code,
      callsign,
      mhz,
    }));
    if (frequencies.length === 0) continue;
    radioByOwner.set(owner, [
      ...(radioByOwner.get(owner) ?? []),
      ...frequencies,
    ]);
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
        frequencies: radioByOwner.get(ad.attributes.pk) ?? [],
        status: childText(ad, 'AdStatut'),
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
    let ring = closeRing(parseGeometrie(childText(partie, 'Geometrie')));
    if (ring.length < 4) {
      const circleSpec = circleOfContour(childText(partie, 'Contour'));
      if (circleSpec) {
        ring = circle(circleSpec.lat, circleSpec.lon, circleSpec.radiusNm);
      } else if (ring.length >= 1) {
        ring = circle(ring[0][1], ring[0][0], POINT_ZONE_RADIUS_NM);
        report.warnings.push(
          `${spaceName}: published as a point, drawn as a 1 km circle`,
        );
      } else {
        bump(report.skipped, 'airspace without geometry');
        continue;
      }
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
    const remarks = [childText(volume, 'Remarque'), ...alternatives]
      .filter(Boolean)
      .join('\n')
      .replace(/#/g, '\n');
    const scheduleCode = childText(volume, 'HorCode');
    const activity =
      childText(volume, 'Activite') ??
      childText(volume, 'HorTxt') ??
      (scheduleCode === 'H24' ? 'H24' : null);
    for (const type of types) {
      airspaces.push({
        sourceId: `${espace.attributes.pk}/${partie.attributes.pk}/${volume.attributes.pk}${types.length > 1 ? `/${type}` : ''}`,
        name,
        type,
        icaoClass: childText(volume, 'Classe'),
        floor,
        ceiling,
        activity,
        scheduleCode,
        frequencies: radioByOwner.get(espace.attributes.pk) ?? [],
        remarks: remarks || null,
        geometry: [[ring]],
      });
      bump(report.counts, `airspace ${type}`);
    }
  }

  return { effectiveDate, version, points, airspaces };
}
