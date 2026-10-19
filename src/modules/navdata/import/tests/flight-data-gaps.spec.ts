import { AddObstaclesAndAirspaceHours1800000000001 } from '../../../../migrations/1800000000001-AddObstaclesAndAirspaceHours';
import { navLogFrequency } from '../../../navplan/engine/aerodrome';
import { mergeAixmRunwayEnds, parseAixmRunwayEnds } from '../aixm.parser';
import {
  BundlePoint,
  emptyReport,
  UNKNOWN_OUTLINE_COUNT,
} from '../bundle-types';
import { aerodromeSheetOf, renderSheet } from '../../navdata.service';
import { fuelGrades, parseSiaXml } from '../sia-xml.parser';
import { siaInLanguage } from '../sia-text';
import { eaipFolder, vacUrl } from '../vac';
import { validateBundle } from '../validate';
import { decodeXmlBuffer } from '../xml';
import { NavPointEntity } from '../../entity/navdata.entity';
import {
  AIXM_2610_GAPS_XML,
  sia2610GapsBuffer,
} from './fixtures/sia-2610-gaps';

// What the flight preparation lacked, read from records of the real
// AIRAC 2610 export (fixtures/sia-2610-gaps.ts).

const report = emptyReport();
const parsed = parseSiaXml(decodeXmlBuffer(sia2610GapsBuffer()), report);
mergeAixmRunwayEnds(
  parsed.points,
  parseAixmRunwayEnds(AIXM_2610_GAPS_XML),
  report,
);
const aerodrome = (icao: string) =>
  parsed.points.find((p) => p.type === 'AERODROME' && p.ident === icao)!;
const airspace = (name: string) =>
  parsed.airspaces.find((a) => a.name.startsWith(name))!;

describe('aerodrome sheet data (AIRAC 2610)', () => {
  it('keeps the status, the VFR traffic, the hours and the fuel grades of LFOP', () => {
    const info = aerodrome('LFOP').extra!.info!;
    expect(info).toMatchObject({
      status: 'CAP',
      vfr: true,
      magneticVariationDeg: 1.44,
      ad2: true,
      fuelTypes: ['100LL', 'JET A1'],
    });
    expect(siaInLanguage(info.fuelHours, 'fr')).toMatch(/^HOR AVT : LUN - VEN/);
    expect(siaInLanguage(info.fuelHours, 'en')).not.toMatch(/LUN - VEN/);
  });

  it('tells the A/A of LFOP from its tower by their hours and remark', () => {
    const frequencies = aerodrome('LFOP').extra!.frequencies!;
    expect(frequencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          service: 'A/A',
          mhz: '120.200',
          hoursCode: 'HX',
          remark: 'Absence ATS',
        }),
        expect.objectContaining({
          service: 'TWR',
          callsign: 'ROUEN Tour',
          mhz: '120.200',
          hoursCode: 'HO',
        }),
      ]),
    );
  });

  it('gives LFBO the tower the SIA publishes on its CTR only, and calls ground GND', () => {
    const frequencies = aerodrome('LFBO').extra!.frequencies!;
    expect(frequencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          service: 'TWR',
          callsign: 'BLAGNAC Tour',
          mhz: '118.105',
        }),
        expect.objectContaining({
          service: 'GND',
          callsign: 'BLAGNAC Sol',
          mhz: '121.905',
        }),
      ]),
    );
  });

  it('prints the right frequency on the nav log, both when the tower hours are not known', () => {
    const sheet = (icao: string) => ({
      frequencies: aerodrome(icao).extra!.frequencies!,
      atsHoursCode: aerodrome(icao).extra!.info!.atsHoursCode,
    });
    expect(navLogFrequency(sheet('LFOP'), 'departure')).toBe(
      'TWR / A/A 120.200 · ATIS 120.730',
    );
    expect(navLogFrequency(sheet('LFOP'), 'alternate')).toBe(
      'TWR / A/A 120.200',
    );
    expect(navLogFrequency(sheet('LFBO'), 'departure')).toBe(
      'TWR 118.105 · GND 121.905',
    );
    expect(navLogFrequency(sheet('LFBO'), 'destination')).toBe('TWR 118.105');
    // A tower in H24 is the only frequency; A/A alone when no ATS.
    expect(
      navLogFrequency(
        {
          atsHoursCode: 'H24',
          frequencies: [
            { service: 'TWR', callsign: null, mhz: '118.200' },
            { service: 'A/A', callsign: null, mhz: '123.500' },
          ],
        },
        'enroute',
      ),
    ).toBe('TWR 118.200');
    expect(
      navLogFrequency(
        {
          atsHoursCode: null,
          frequencies: [
            { service: 'VDF', callsign: null, mhz: '119.050' },
            { service: 'A/A', callsign: null, mhz: '119.050' },
          ],
        },
        'destination',
      ),
    ).toBe('A/A 119.050');
  });

  it('reads the declared distances of each runway direction, from the XML SIA and the AIXM file', () => {
    const grass = aerodrome('LFOP').extra!.runways!.find(
      (r) => r.designator === '05/23',
    )!;
    expect(grass).toMatchObject({ lengthM: 900, widthM: 80, surface: 'gazon' });
    expect(grass.ends).toEqual([
      expect.objectContaining({
        designator: '05',
        magneticBearingDeg: 42.38,
        trueBearingDeg: 43.82,
        toraM: 900,
        todaM: 900,
        asdaM: 900,
        ldaM: 815,
        displacedThreshold: true,
      }),
      expect.objectContaining({
        designator: '23',
        magneticBearingDeg: 222.38,
        // No Rdd for 23 in the fixture: the XML SIA LDA stays.
        toraM: null,
        ldaM: 815,
      }),
    ]);
  });

  it('leaves out the distances from an intersection', () => {
    const ends = parseAixmRunwayEnds(AIXM_2610_GAPS_XML);
    expect(ends.has('LFLY|16/34|16')).toBe(false);
    expect(ends.get('LFOP|05/23|05')?.toraM).toBe(900);
  });

  it('keeps LFMM (AdStatut OFF) with its status, for the API to keep it out of routes', () => {
    expect(aerodrome('LFMM').extra!.info!.status).toBe('OFF');
  });

  it('reads the fuel grades a pilot looks for', () => {
    expect(
      fuelGrades(
        'Carburants : 100 LL - JET A1 - JET SAF - UL AERO SUPER +# Paiement : Cartes\\\\Fuel : 100 LL',
      ),
    ).toEqual(['100LL', 'UL AERO SUPER+', 'JET A1', 'JET SAF']);
    expect(fuelGrades('UL91 - JET A1')).toEqual(['UL91', 'JET A1']);
    expect(fuelGrades('Carburants : AVGAS, Jet A1.')).toEqual([
      '100LL',
      'JET A1',
    ]);
    expect(fuelGrades('NIL')).toEqual([]);
    expect(fuelGrades(null)).toEqual([]);
  });
});

describe('VAC link and sheet as read', () => {
  it('names the eAIP folder of the cycle', () => {
    expect(eaipFolder(new Date('2026-10-01T00:00:00Z'))).toBe(
      'eAIP_01_OCT_2026',
    );
    expect(vacUrl('LFPN', new Date('2026-10-01T00:00:00Z'))).toBe(
      'https://www.sia.aviation-civile.gouv.fr/media/dvd/eAIP_01_OCT_2026/Atlas-VAC/PDF_AIPparSSection/VAC/AD/AD-2.LFPN.pdf',
    );
  });

  const row = (point: BundlePoint) =>
    ({
      ident: point.ident,
      name: point.name,
      elevation_ft: point.elevationFt,
      source: point.source,
      extra: point.extra,
    }) as NavPointEntity;
  const cycle = { has_sia: true, effective_from: new Date('2026-10-01') };

  it('links the VAC of an aerodrome, none for a place that is not one or a VAC found missing', () => {
    expect(aerodromeSheetOf(row(aerodrome('LFOP')), cycle).vacUrl).toMatch(
      /eAIP_01_OCT_2026\/.*AD-2\.LFOP\.pdf$/,
    );
    expect(aerodromeSheetOf(row(aerodrome('LFMM')), cycle).vacUrl).toBeNull();
    const missing = row(aerodrome('LFOP'));
    missing.extra = {
      ...missing.extra,
      info: { ...missing.extra!.info, vac: false },
    };
    expect(aerodromeSheetOf(missing, cycle)).toMatchObject({
      vacUrl: null,
      chartsUrl: 'https://www.sia.aviation-civile.gouv.fr/',
    });
    expect(
      aerodromeSheetOf(row(aerodrome('LFOP')), { ...cycle, has_sia: false })
        .vacUrl,
    ).toBeNull();
  });

  it('writes the SIA texts in the language of the reader', () => {
    const sheet = aerodromeSheetOf(row(aerodrome('LFOP')), cycle);
    expect(renderSheet(sheet, 'fr').fuelHours).toMatch(/LUN - VEN/);
    expect(renderSheet(sheet, 'en').fuelHours).toMatch(/MON - FRI|MON-FRI/);
  });
});

describe('activity zones (AIRAC 2610)', () => {
  it('imports parachuting, model aircraft and low-level overflight bans at their point', () => {
    const pje = airspace('Pje 215');
    expect(pje).toMatchObject({
      type: 'PARACHUTING',
      floor: { ref: 'SFC', value: 0 },
      ceiling: { ref: 'FL', value: 145 },
      geometry: [],
      referencePoint: { lat: 47.205278, lon: 6.080556 },
      hours:
        'SUM : MON-FRI : 0700-SS\nWIN : MON-FRI : 0800-SS\nSAT, SUN and HOL: SR-SS',
    });
    expect(pje.remarks).toMatch(/RAKI RADAR/);
    expect(airspace('Aer 8430')).toMatchObject({
      type: 'MODEL_AIRCRAFT',
      ceiling: { ref: 'AMSL', value: 2500 },
      hours: 'SR-SS',
    });
  });

  it('keeps the activity and the hours apart', () => {
    expect(airspace('SUR 231')).toMatchObject({
      type: 'LOW_OVERFLIGHT',
      ceiling: { ref: 'AGL', value: 1000 },
      activity:
        'Survols interdits à basse ALT\n1000ft MNM monomoteurs à piston/hélicoptères\n3300ft MNM autres ACFT moto-propulsés',
      hours: 'H24',
    });
  });

  it('does not count them as areas of unknown outline', () => {
    expect(report.counts[UNKNOWN_OUTLINE_COUNT]).toBeUndefined();
    expect(report.warnings.some((w) => /Pje|SUR|Aer/.test(w))).toBe(false);
    const validation = emptyReport();
    validateBundle(
      {
        schema: 2,
        airac: '2610',
        effectiveFrom: '2026-10-01T00:00:00Z',
        effectiveTo: '2026-10-29T00:00:00Z',
        source: '',
        builtAt: '',
        sources: { sia: { file: '', effectiveDate: null, version: '5' } },
        points: [],
        airspaces: parsed.airspaces,
      },
      null,
      validation,
    );
    expect(validation.errors.some((e) => /no outline/.test(e))).toBe(false);
  });
});

describe('obstacles (AIRAC 2610)', () => {
  it('imports an obstacle of metropolitan France with its heights and lighting', () => {
    expect(parsed.obstacles).toEqual([
      {
        ident: 'E4414-1',
        type: 'Eolienne(s)',
        lat: 46.991578,
        lon: -1.641,
        amslFt: 503,
        aglFt: 408,
        count: 1,
        lighting: 'jour et nuit',
        remark: null,
      },
    ]);
    expect(report.counts.obstacles).toBe(1);
  });

  it('adds the obstacles table and the hours column, again and again without failing', async () => {
    const statements: string[] = [];
    const runner = {
      query: jest.fn(async (sql: string) => {
        statements.push(sql.replace(/\s+/g, ' ').trim());
      }),
    };
    await new AddObstaclesAndAirspaceHours1800000000001().up(runner as any);
    for (const statement of statements)
      expect(statement).toMatch(
        /^(CREATE TABLE IF NOT EXISTS "obstacles"|CREATE INDEX IF NOT EXISTS|ALTER TABLE "airspaces" ADD COLUMN IF NOT EXISTS "hours")/,
      );
    statements.length = 0;
    await new AddObstaclesAndAirspaceHours1800000000001().down(runner as any);
    expect(statements).toEqual([
      'DROP TABLE IF EXISTS "obstacles"',
      'ALTER TABLE "airspaces" DROP COLUMN IF EXISTS "hours"',
    ]);
  });
});
