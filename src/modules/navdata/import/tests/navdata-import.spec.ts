import { readFileSync } from 'fs';
import { deflateRawSync } from 'zlib';
import {
  airacCycleAt,
  airacCycleByIdent,
  cyclesBehind,
  nextAiracCycle,
} from '../airac';
import {
  buildBundle,
  decodeBundle,
  encodeBundle,
  sha256,
  siaXmlOf,
} from '../bundle';
import {
  BundleAirspace,
  emptyReport,
  UNKNOWN_OUTLINE_COUNT,
} from '../bundle-types';
import { bboxOf } from '../navdata-import.service';
import { isActivityType } from '../../../navplan/engine/airspace-intersection';
import { parseCsv, parseOurAirports } from '../ourairports';
import { parseSiaXml } from '../sia-xml.parser';
import {
  isSimpleRing,
  MAX_UNKNOWN_OUTLINE_SHARE,
  summarize,
  validateBundle,
} from '../validate';
import { siaSampleBuffer, SIA_SAMPLE_XML } from './fixtures/sia-sample';
import { sia2310ExcerptsBuffer } from './fixtures/sia-2310-excerpts';
import { sia2610ExcerptsBuffer } from './fixtures/sia-2610-excerpts';
import { siaText } from '../sia-text';
import { decodeXmlBuffer, walkXml } from '../xml';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('AIRAC cycles', () => {
  it('2601 on 2026-01-22, 2610 on 2026-10-01, 2611 on 2026-10-29', () => {
    expect(airacCycleAt(day('2026-01-22')).ident).toBe('2601');
    expect(airacCycleAt(day('2026-10-16')).ident).toBe('2610');
    expect(airacCycleAt(day('2026-10-16')).effectiveFrom).toEqual(
      day('2026-10-01'),
    );
    expect(nextAiracCycle(day('2026-10-16'))).toEqual({
      ident: '2611',
      effectiveFrom: day('2026-10-29'),
      effectiveTo: day('2026-11-26'),
    });
  });

  it('numbers restart at 01 with the first cycle of a year', () => {
    expect(airacCycleAt(day('2026-12-31')).ident).toBe('2613');
    expect(airacCycleAt(day('2027-01-21')).ident).toBe('2701');
    expect(airacCycleAt(day('2026-01-21')).ident).toBe('2513');
    expect(airacCycleByIdent('2611')?.effectiveFrom).toEqual(day('2026-10-29'));
    expect(airacCycleByIdent('2615')).toBeNull();
  });

  it('counts the cycles behind', () => {
    expect(cyclesBehind(day('2026-10-01'), day('2026-10-28'))).toBe(0);
    expect(cyclesBehind(day('2026-10-01'), day('2026-10-29'))).toBe(1);
    expect(cyclesBehind(day('2026-10-01'), day('2026-12-24'))).toBe(3);
  });
});

describe('XML reader', () => {
  it('reads ISO-8859-1, entities and nested elements', () => {
    const xml = decodeXmlBuffer(
      Buffer.from(
        '<?xml version="1.0" encoding="ISO-8859-1"?><a><b x="1&amp;2">é &lt;ok&gt;</b></a>',
        'latin1',
      ),
    );
    const seen: string[] = [];
    walkXml(xml, 1, (element) =>
      seen.push(`${element.name}:${element.attributes.x}:${element.text}`),
    );
    expect(seen).toEqual(['b:1&2:é <ok>']);
  });
});

describe('SIA XML parser', () => {
  const report = emptyReport();
  const xml = decodeXmlBuffer(siaSampleBuffer());
  const parsed = parseSiaXml(xml, report);
  const airspace = (name: string) =>
    parsed.airspaces.find((a) => a.name.startsWith(name));

  it('reads the effective date and the version', () => {
    expect(parsed.effectiveDate).toBe('2026-10-29');
    expect(parsed.version).toBe('5');
  });

  it('reads aerodromes with their runways and frequencies, accents decoded', () => {
    const lfop = parsed.points.find((p) => p.ident === 'LFOP');
    expect(lfop).toMatchObject({
      type: 'AERODROME',
      name: 'ROUEN VALLÉE DE SEINE',
      lat: 49.384167,
      lon: 1.174722,
      elevationFt: 512,
      source: 'SIA',
    });
    expect(lfop.extra.runways).toMatchObject([
      {
        designator: '04/22',
        trueHeadingDeg: 42,
        lengthM: 1700,
        widthM: 45,
        surface: 'Revêtue',
        ends: [
          { designator: '04', trueBearingDeg: 42 },
          { designator: '22', trueBearingDeg: 222 },
        ],
      },
    ]);
    expect(lfop.extra.frequencies).toMatchObject([
      { service: 'TWR', callsign: 'ROUEN Tour', mhz: '118.900' },
    ]);
  });

  it('reads a VOR-DME and an NDB with their frequencies, and skips IFR waypoints', () => {
    expect(parsed.points.find((p) => p.ident === 'TST')).toMatchObject({
      type: 'VOR_DME',
      frequency: '113.90',
      name: 'TESTVILLE',
    });
    expect(parsed.points.find((p) => p.ident === 'TN')).toMatchObject({
      type: 'NDB',
      frequency: '330',
    });
    expect(parsed.points.find((p) => p.ident === 'ABCDE')).toBeUndefined();
    expect(report.skipped['NavFix WPT']).toBe(1);
  });

  it('reads a VFR reporting point attached to its aerodrome', () => {
    expect(parsed.points.find((p) => p.type === 'VRP')).toMatchObject({
      ident: 'NW',
      aerodromeIcao: 'LFPN',
      mandatory: true,
    });
  });

  it('reads floors and ceilings with their references: SFC, AMSL, FL, ASFC', () => {
    expect(airspace('CTR TOUSSUS')).toMatchObject({
      type: 'CTR',
      icaoClass: 'D',
      floor: { ref: 'SFC', value: 0 },
      ceiling: { ref: 'AMSL', value: 1500 },
      frequencies: [
        { service: 'TWR', callsign: 'TOUSSUS Tour', mhz: '119.300' },
      ],
    });
    expect(airspace('TMA TEST')).toMatchObject({
      floor: { ref: 'AMSL', value: 1500 },
      ceiling: { ref: 'FL', value: 65 },
    });
    expect(airspace('R 999')).toMatchObject({
      type: 'R',
      ceiling: { ref: 'AGL', value: 3000 },
      scheduleCode: 'NOTAM',
      activity: null,
      remarks: 'Activité publiée par NOTAM\nRTBA test',
    });
    expect(airspace('D 998')).toMatchObject({
      type: 'D',
      activity: 'Tirs',
      floor: { ref: 'AMSL', value: 2000 },
    });
    expect(airspace('SIV TEST')).toMatchObject({
      type: 'SIV',
      floor: { ref: 'SFC', value: 0 },
      ceiling: { ref: 'FL', value: 65 },
      frequencies: [{ service: 'FIS', callsign: 'TEST Info', mhz: '126.100' }],
    });
    expect(airspace('PRN 001')).toMatchObject({
      type: 'PROTECTED',
      ceiling: { ref: 'AGL', value: 1000 },
    });
  });

  it('draws a zone published as a circle and skips types it does not use', () => {
    const p = airspace('P 99');
    expect(p.name).toBe('P 99 CENTRALE TEST');
    expect(p.geometry[0][0]).toHaveLength(73);
    expect(isSimpleRing(p.geometry[0][0])).toBe(true);
    expect(airspace('AWY')).toBeUndefined();
    expect(report.skipped['airspace type AWY']).toBe(1);
  });

  it('finds the XML in the zip the SIA delivers', () => {
    const data = siaSampleBuffer();
    const compressed = deflateRawSync(data);
    const name = Buffer.from('XML_SIA_2026-10-29.xml');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(0, 42);
    const centralOffset = local.length + name.length + compressed.length;
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(1, 8);
    end.writeUInt16LE(1, 10);
    end.writeUInt32LE(central.length + name.length, 12);
    end.writeUInt32LE(centralOffset, 16);
    const zip = Buffer.concat([local, name, compressed, central, name, end]);
    const found = siaXmlOf('sia.zip', zip);
    expect(found.name).toBe('XML_SIA_2026-10-29.xml');
    expect(found.xml).toBe(SIA_SAMPLE_XML);
  });
});

describe('OurAirports and the bundle', () => {
  const files = {
    airports: [
      'id,ident,type,name,latitude_deg,longitude_deg,elevation_ft,continent,iso_country,iso_region,municipality,scheduled_service,icao_code,iata_code,gps_code,local_code,home_link,wikipedia_link,keywords',
      '1,LFOP,medium_airport,"Rouen Vallée de Seine",49.384,1.1748,512,EU,FR,FR-NOR,Rouen,no,LFOP,URO,LFOP,,,,',
      '2,LFFE,small_airport,"Enghien Moisselles",49.046,2.3531,335,EU,FR,FR-IDF,,no,,,LFFE,,,,',
      '3,EBAW,medium_airport,"Antwerp",51.189,4.46,39,EU,BE,BE-VAN,,yes,EBAW,ANR,EBAW,,,,',
      '4,FR-0001,heliport,"Hélistation",48,2,0,EU,FR,,,no,,,,,,,',
      '5,KJFK,large_airport,"JFK",40.6,-73.7,13,NA,US,,,yes,KJFK,JFK,KJFK,,,,',
    ].join('\n'),
    runways: [
      'id,airport_ref,airport_ident,length_ft,width_ft,surface,lighted,closed,le_ident,le_latitude_deg,le_longitude_deg,le_elevation_ft,le_heading_degT,le_displaced_threshold_ft,he_ident',
      '10,2,LFFE,2297,59,ASP,0,0,02,,,,23,,20',
    ].join('\n'),
    frequencies: [
      'id,airport_ref,airport_ident,type,description,frequency_mhz',
      '20,2,LFFE,A/A,ENGHIEN Auto-info,123.5',
      '21,1,LFOP,TWR,ROUEN TWR,118.9',
    ].join('\n'),
  };

  it('parses quoted CSV', () => {
    expect(parseCsv('a,b\n"x, ""y""",2\n')).toEqual([{ a: 'x, "y"', b: '2' }]);
  });

  it('keeps the aerodromes of the countries served, not heliports', () => {
    const points = parseOurAirports(files, emptyReport());
    expect(points.map((p) => p.ident).sort()).toEqual(['EBAW', 'LFFE', 'LFOP']);
    expect(points.find((p) => p.ident === 'LFFE').extra.runways[0]).toEqual({
      designator: '02/20',
      trueHeadingDeg: 23,
      lengthM: 700,
      widthM: 18,
      surface: 'ASP',
    });
  });

  it('builds a bundle: SIA first, OurAirports for the rest, round trip with SHA-256', () => {
    const { bundle, report } = buildBundle({
      sia: { fileName: 'XML_SIA_2026-10-29.xml', data: siaSampleBuffer() },
      ourAirports: { files, downloadedAt: day('2026-10-16') },
      now: day('2026-10-16'),
    });
    expect(bundle.airac).toBe('2611');
    expect(bundle.effectiveFrom).toBe('2026-10-29T00:00:00.000Z');
    expect(bundle.source).toContain("Service de l'Information Aéronautique");
    expect(bundle.source).toContain('mise à jour du 2026-10-29');
    const lfop = bundle.points.filter((p) => p.ident === 'LFOP');
    expect(lfop).toHaveLength(1);
    expect(lfop[0].source).toBe('SIA');
    expect(
      bundle.points.some(
        (p) => p.ident === 'LFFE' && p.source === 'OURAIRPORTS',
      ),
    ).toBe(true);
    expect(report.errors).toEqual([]);

    const encoded = encodeBundle(bundle);
    expect(decodeBundle(encoded, sha256(encoded)).points.length).toBe(
      bundle.points.length,
    );
    expect(() => decodeBundle(encoded, '00')).toThrow(/SHA-256/);
  });

  it('validates a cycle: reference aerodromes, required types, ±10 % per type, closed simple outlines', () => {
    const { bundle } = buildBundle({
      sia: { fileName: 'XML_SIA_2026-10-29.xml', data: siaSampleBuffer() },
      now: day('2026-10-16'),
    });
    const report = emptyReport();
    expect(validateBundle(bundle, null, report)).toBe(true);

    const previous = summarize(bundle);
    previous.airspaceCountByType.CTR = 5;
    previous.aerodromes.LFPN = { lat: 48.76, lon: 2.106111 };
    const second = emptyReport();
    expect(validateBundle(bundle, previous, second)).toBe(false);
    expect(second.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^LFPN moved by \d+ m/),
        'CTR: 1 airspaces, 5 in the previous cycle (more than ±10 %)',
      ]),
    );

    const bowTie = { ...bundle, airspaces: [...bundle.airspaces] };
    bowTie.airspaces.push({
      ...bundle.airspaces[0],
      name: 'BOW',
      geometry: [
        [
          [
            [0, 0],
            [1, 1],
            [1, 0],
            [0, 1],
            [0, 0],
          ],
        ],
      ],
    });
    const third = emptyReport();
    expect(validateBundle(bowTie, null, third)).toBe(false);
    expect(third.errors).toContain(
      'BOW: outline crosses itself or has no area',
    );
  });
});

// Real records of AIRAC 2310 whose outline the reader once drew as a 1 km
// circle, or rejected.
describe('SIA XML parser on the real export (AIRAC 2310 extracts)', () => {
  const report = emptyReport();
  const parsed = parseSiaXml(decodeXmlBuffer(sia2310ExcerptsBuffer()), report);
  const airspace = (name: string) =>
    parsed.airspaces.find((a) => a.name.startsWith(name))!;

  it('keeps an area published as a single point with no outline and its point, never as a small circle', () => {
    const park = airspace('PRN 390');
    expect(park.name).toBe('PRN 390 PARC NATIONAL DES CEVENNES');
    expect(park.geometry).toEqual([]);
    expect(park.referencePoint).toEqual({ lat: 44.25, lon: 3.583333 });
    expect(park.ceiling).toEqual({ ref: 'AGL', value: 3300 });
    expect(airspace('D 595').geometry).toEqual([]);
    expect(report.warnings).toContain(
      'PRN 390 PARC NATIONAL DES CEVENNES: géométrie inconnue / unknown outline (published as the point 44.25 3.583333 only), listed in the plans near it',
    );
    expect(report.warnings.some((w) => /circle/.test(w))).toBe(false);
  });

  it('a part defined in words cannot be located', () => {
    const lta = airspace('LTA FRANCE 2');
    expect(lta.geometry).toEqual([]);
    expect(lta.referencePoint).toBeNull();
    expect(lta.floor).toEqual({ ref: 'FL', value: 115 });
  });

  it('counts the areas without an outline in the report, with a total', () => {
    expect(report.counts[UNKNOWN_OUTLINE_COUNT]).toBe(3);
    expect(report.warnings).toContain(
      'Géométrie inconnue / unknown outline: 3 airspace(s) of 7, not drawn, flagged in the plans',
    );
  });

  it('rebuilds the rings of a part made of several islets from its Contour', () => {
    const islets = airspace('PRN 25');
    expect(islets.geometry).toHaveLength(2);
    expect(islets.geometry[0][0][0]).toEqual([-61.777778, 16.363889]);
    for (const [ring] of islets.geometry) expect(isSimpleRing(ring)).toBe(true);
  });

  it('drops a repeated point so that the outline is simple', () => {
    const tma = airspace('TMA BALE deleg.LANGEN S-E');
    const ring = tma.geometry[0][0];
    expect(ring).toHaveLength(18);
    expect(isSimpleRing(ring)).toBe(true);
  });

  it('no zone falls back to a point or a circle', () => {
    for (const a of parsed.airspaces) {
      for (const polygon of a.geometry) {
        expect(polygon[0].length).toBeGreaterThanOrEqual(4);
        expect(polygon[0]).not.toHaveLength(73);
      }
    }
  });

  it('stores the point as the box of an area without outline, the world when not located', () => {
    expect(bboxOf([], { lat: 44.25, lon: 3.583333 })).toEqual({
      min_lat: 44.25,
      max_lat: 44.25,
      min_lon: 3.583333,
      max_lon: 3.583333,
    });
    expect(bboxOf([], null)).toEqual({
      min_lat: -90,
      max_lat: 90,
      min_lon: -180,
      max_lon: 180,
    });
  });
});

// Real records of AIRAC 2610, the first export imported in production: the
// CTRs and TMAs had no frequency (a service naming its aerodrome and its
// airspace went to the aerodrome only) and the activities kept the "#\\"
// of the export.
describe('SIA XML parser on the real export (AIRAC 2610 extracts)', () => {
  const report = emptyReport();
  const parsed = parseSiaXml(decodeXmlBuffer(sia2610ExcerptsBuffer()), report);
  const airspace = (name: string) =>
    parsed.airspaces.find((a) => a.name.startsWith(name))!;

  it('gives a CTR the frequency of the service that names it with its aerodrome', () => {
    const ctr = airspace('CTR AGEN LA GARENNE');
    expect(ctr.icaoClass).toBe('D');
    expect(ctr.frequencies).toEqual([
      {
        service: 'TWR',
        callsign: 'AGEN Tour',
        mhz: '121.305',
        hoursCode: 'HO',
        hours: null,
        remark: null,
        auxiliary: false,
      },
    ]);
  });

  it('cleans a bilingual activity and the remarks: French line, then English line', () => {
    const r97 = airspace('R 97');
    expect(r97.name).toBe('R 97 MONCE');
    expect(r97.activity).toBe('Activités vélivoles.\nGliding activities');
    expect(r97.remarks).toBe(
      'CAG IFR : contournement obligatoire.\nCAG VFR, CAM : Veille obligatoire de la fréquence STRASBOURG APP.\nActivité connue de STRASBOURG APP.',
    );
  });
});

describe('SIA free text', () => {
  it('turns "#" and "#\\\\" into lines, drops CR LF and empty lines, idempotent', () => {
    expect(siaText("Procédures d'aérodromes#\\\\Aerodrome procedures")).toBe(
      "Procédures d'aérodromes\nAerodrome procedures",
    );
    expect(
      siaText('SUM : MON-SUN : 0530-2030#\r\n#WIN : MON-SUN : 0630-1930'),
    ).toBe('SUM : MON-SUN : 0530-2030\nWIN : MON-SUN : 0630-1930');
    expect(siaText(siaText('A#\\\\B'))).toBe('A\nB');
    expect(siaText('#')).toBeNull();
    expect(siaText(null)).toBeNull();
  });
});

// The whole export (26 MB, not kept in the repository): run with
// SIA_REAL_EXPORT=<path to export_xml_bd_sia_*.zip>.
const realExport = process.env.SIA_REAL_EXPORT;
(realExport ? describe : describe.skip)('the whole real SIA export', () => {
  it('builds a cycle that passes validation, with no zone drawn as a point or a circle', () => {
    const { bundle, report } = buildBundle({
      sia: {
        fileName: 'export.zip',
        data: readFileSync(realExport as string),
      },
    });
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((w) => /circle/.test(w))).toBe(false);
    // Activities (parachuting, model aircraft...) are published at a point.
    const unknown = bundle.airspaces.filter(
      (a) => a.geometry.length === 0 && !isActivityType(a.type),
    );
    expect(report.counts[UNKNOWN_OUTLINE_COUNT] ?? 0).toBe(unknown.length);
    for (const a of bundle.airspaces) {
      for (const polygon of a.geometry) {
        expect(polygon[0].length).toBeGreaterThanOrEqual(4);
        expect(isSimpleRing(polygon[0])).toBe(true);
      }
    }
    const validation = emptyReport();
    expect(validateBundle(bundle, null, validation)).toBe(true);
    // AIRAC 2610: the obstacles of metropolitan France, the declared
    // distances of the AIXM file.
    expect(bundle.obstacles?.length).toBeGreaterThan(13000);
    expect(
      report.counts['runway directions with AIXM distances'],
    ).toBeGreaterThan(1400);
  });
});

describe('cycles with areas without an outline', () => {
  const { bundle } = buildBundle({
    sia: { fileName: 'XML_SIA_2026-10-29.xml', data: siaSampleBuffer() },
    now: day('2026-10-16'),
  });
  const withUnknown = (type: string, count: number) => ({
    ...bundle,
    airspaces: [
      ...bundle.airspaces,
      ...Array.from({ length: count }, (_, i) => ({
        ...bundle.airspaces[0],
        name: `${type} ${i}`,
        type: type as BundleAirspace['type'],
        geometry: [],
        referencePoint: { lat: 45, lon: 5 },
      })),
    ],
  });

  it(`rejects a cycle where more than ${MAX_UNKNOWN_OUTLINE_SHARE * 100} % of the airspaces have no outline, protected areas left out`, () => {
    const counted = bundle.airspaces.filter(
      (a) => a.type !== 'PROTECTED',
    ).length;
    const report = emptyReport();
    expect(validateBundle(withUnknown('R', 1), null, report)).toBe(false);
    expect(report.errors).toContain(
      `1 of ${counted + 1} airspaces (protected areas left out) have no outline (géométrie inconnue), more than 5 %`,
    );
    expect(
      validateBundle(withUnknown('PROTECTED', 20), null, emptyReport()),
    ).toBe(true);
  });

  it('refuses a schema 1 bundle with SIA data, still reads an aerodromes-only one', () => {
    const old = encodeBundle({ ...bundle, schema: 1 });
    expect(() => decodeBundle(old)).toThrow(/rebuild/);
    const aerodromesOnly = encodeBundle({
      ...bundle,
      schema: 1,
      sources: {},
      airspaces: [],
    });
    expect(decodeBundle(aerodromesOnly).schema).toBe(1);
  });
});
