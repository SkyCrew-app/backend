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
import { emptyReport } from '../bundle-types';
import { parseCsv, parseOurAirports } from '../ourairports';
import { parseSiaXml } from '../sia-xml.parser';
import { isSimpleRing, summarize, validateBundle } from '../validate';
import { siaSampleBuffer, SIA_SAMPLE_XML } from './fixtures/sia-sample';
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
    expect(lfop.extra.runways).toEqual([
      {
        designator: '04/22',
        trueHeadingDeg: 42,
        lengthM: 1700,
        widthM: 45,
        surface: 'Revêtue',
      },
    ]);
    expect(lfop.extra.frequencies).toEqual([
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
