import { inflateSync } from 'zlib';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
} from 'pdf-lib';
import { computeFlightPlan, FlightPlanResult } from '../../engine/engine';
import { engineInput } from '../../engine/tests/fixture';
import { AerodromeSheet } from '../../engine/aerodrome';
import { buildDossierPdf, navdataLabel, qnhOrigin } from '../dossier.pdf';
import { readTrueType } from '../truetype-font';
import { readFileSync } from 'fs';
import { join } from 'path';

// The WinAnsi codes 0x80-0x9F the flight file uses; the rest is Latin-1.
const WIN_ANSI: Record<number, string> = {
  0x80: '€',
  0x85: '…',
  0x8c: 'Œ',
  0x91: '‘',
  0x92: '’',
  0x93: '“',
  0x94: '”',
  0x95: '•',
  0x96: '–',
  0x97: '—',
  0x9c: 'œ',
};

const load = async (base64: string) =>
  PDFDocument.load(Buffer.from(base64, 'base64'));

// The text of the pages in drawing order (pdf-lib writes one hex string per
// line of text).
function pageText(doc: PDFDocument): string[] {
  const lines: string[] = [];
  for (const page of doc.getPages()) {
    const contents = page.node.Contents();
    const streams =
      contents instanceof PDFArray
        ? contents.asArray().map((ref) => doc.context.lookup(ref))
        : [contents];
    for (const stream of streams) {
      const raw = stream as PDFRawStream;
      const bytes = raw.dict.get(PDFName.of('Filter'))
        ? inflateSync(Buffer.from(raw.contents))
        : Buffer.from(raw.contents);
      for (const match of bytes
        .toString('latin1')
        .matchAll(/<([0-9A-F]*)> Tj/g)) {
        const hex = match[1];
        let line = '';
        for (let i = 0; i < hex.length; i += 2) {
          const code = parseInt(hex.slice(i, i + 2), 16);
          line += WIN_ANSI[code] ?? String.fromCharCode(code);
        }
        lines.push(line);
      }
    }
  }
  return lines;
}

function fonts(doc: PDFDocument): PDFDict[] {
  return doc.context
    .enumerateIndirectObjects()
    .map(([, object]) => object)
    .filter(
      (object): object is PDFDict =>
        object instanceof PDFDict &&
        object.get(PDFName.of('Type')) === PDFName.of('Font'),
    );
}

const tomorrowMorning = (): FlightPlanResult =>
  computeFlightPlan(
    engineInput({
      departureTime: new Date('2026-10-17T08:00:00Z'),
      qnhHpa: 1023,
      qnhSource: 'METAR',
      qnhStation: 'LFRS',
      qnhObservedAt: new Date('2026-10-16T17:30:00Z'),
    }),
  );

const options = (result: FlightPlanResult, format: 'A4' | 'A5' = 'A4') => ({
  result: JSON.parse(JSON.stringify(result)),
  format,
  language: 'fr' as const,
  pilot: 'Jeanne Pilote',
  aircraft: 'F-TEST (DR400)',
  weighingDate: null,
});

describe('flight file PDF: fonts and contents', () => {
  it('embeds its TrueType fonts (no standard font left to the viewer)', async () => {
    for (const format of ['A4', 'A5'] as const) {
      const doc = await load(
        await buildDossierPdf(options(tomorrowMorning(), format)),
      );
      const found = fonts(doc);
      expect(found).toHaveLength(2);
      for (const font of found) {
        expect(font.get(PDFName.of('Subtype'))).toBe(PDFName.of('TrueType'));
        expect(String(font.get(PDFName.of('BaseFont')))).toMatch(
          /^\/LiberationSans/,
        );
        const descriptor = doc.context.lookup(
          font.get(PDFName.of('FontDescriptor')) as PDFRef,
        ) as PDFDict;
        const file = doc.context.lookup(
          descriptor.get(PDFName.of('FontFile2')) as PDFRef,
        ) as PDFRawStream;
        expect(file.contents.length).toBeGreaterThan(50_000);
      }
    }
  });

  it('measures the text with the widths it embeds (Liberation Sans is metric-compatible with Helvetica)', () => {
    const font = readTrueType(
      readFileSync(
        join(__dirname, '..', 'fonts', 'LiberationSans-Regular.ttf'),
      ),
    );
    const per1000 = (c: string) =>
      ((font.advanceOf(c.codePointAt(0) as number) as number) * 1000) /
      font.unitsPerEm;
    // Helvetica AFM widths: a 556, W 944, é 556, space 278, ° 400.
    expect(per1000('a')).toBeCloseTo(556, 0);
    expect(per1000('W')).toBeCloseTo(944, 0);
    expect(per1000('é')).toBeCloseTo(556, 0);
    expect(per1000(' ')).toBeCloseTo(278, 0);
    expect(per1000('°')).toBeCloseTo(400, 0);
  });

  it('puts the warnings under the verdict, in French, with the QNH source and no AIRAC for OurAirports', async () => {
    const text = pageText(
      await load(await buildDossierPdf(options(tomorrowMorning()))),
    );
    const index = (pattern: RegExp) =>
      text.findIndex((line) => pattern.test(line));
    expect(text.join('\n')).not.toMatch(/WARNING|BLOCKING|AIRAC OURAIRPORTS/);
    expect(
      index(/^QNH : 1023\.0 hPa \(METAR LFRS de 16\/10 17:30 UTC\)/),
    ).toBeGreaterThan(-1);
    expect(
      index(
        /Données aéronautiques : données aérodromes OurAirports du 2026-10-16, pas de cycle AIRAC/,
      ),
    ).toBeGreaterThan(-1);
    const banner = index(/^(Points à vérifier avant le départ|HORS LIMITES)/);
    const warnings = index(/^Avertissements$/);
    const log = index(/^Log de navigation$/);
    expect(banner).toBeGreaterThan(-1);
    expect(warnings).toBe(banner + 1);
    expect(log).toBeGreaterThan(warnings);
    expect(
      index(
        /^ATTENTION — QNH issu d’un METAR de 16\/10 17:30 UTC \(LFRS\), à réactualiser avant le départ/,
      ),
    ).toBeGreaterThan(warnings);
    expect(index(/^Soleil \(UTC\) — Vol entièrement de jour/)).toBeGreaterThan(
      -1,
    );
    expect(
      index(
        /^LFRS \(départ, 2026-10-17\) : début du crépuscule civil 05:56, lever 06:27, coucher 17:15, fin du crépuscule civil 17:46/,
      ),
    ).toBeGreaterThan(-1);
  });

  it('says the flight is at night, and the calm wind assumed without a forecast', async () => {
    const night = computeFlightPlan(
      engineInput({ departureTime: new Date('2026-10-16T19:00:00Z') }),
    );
    const text = pageText(await load(await buildDossierPdf(options(night))));
    expect(text).toContain(
      'Soleil (UTC) — Vol en partie de nuit à partir de 16/10 19:00 UTC : réserve finale de nuit (45 min).',
    );
    expect(text).toContain('Réserve finale (45 min)');
    expect(text).toContain('000/0*');
    expect(text).toContain('* pas de prévision de vent : vent nul supposé');
  });

  it('labels the QNH and the navigation data', () => {
    const result = tomorrowMorning();
    expect(qnhOrigin({ ...result, qnhSource: 'INPUT' }, 'en')).toBe(
      'entered by the pilot',
    );
    expect(qnhOrigin({ ...result, qnhSource: 'DEFAULT' }, 'fr')).toBe(
      'QNH inconnu, atmosphère standard',
    );
    expect(
      navdataLabel(
        {
          navdata: {
            ...result.navdata,
            airac: '2611',
            effectiveFrom: new Date('2026-10-01T00:00:00Z'),
            stale: true,
          },
        },
        'fr',
      ),
    ).toBe('cycle AIRAC 2611 du 2026-10-01 — PÉRIMÉES');
  });

  // LFRS of AIRAC 2610: runway 03/21, 21 with its displaced threshold (LDA
  // 2591 m), UL91 and JET A1 only.
  const lfrs: AerodromeSheet = {
    icao: 'LFRS',
    name: 'NANTES ATLANTIQUE',
    elevationFt: 90,
    source: 'SIA',
    status: 'CAP',
    vfr: true,
    ifr: true,
    privateFlights: true,
    magneticVariationDeg: 0.72,
    magneticVariationYear: '2025',
    atsHoursCode: 'H24',
    atsHours: 'H 24',
    fuelHours: null,
    fuel: 'UL91 - JET A1',
    fuelRemarks: null,
    fuelTypes: ['UL91', 'JET A1'],
    remarks: null,
    phone: null,
    operator: null,
    runways: [
      {
        designator: '03/21',
        trueHeadingDeg: 27.44,
        lengthM: 2853,
        widthM: 45,
        surface: 'macadam',
        main: true,
        ends: [
          ['03', 27.44, 28.37, 2001, 2853],
          ['21', 207.44, 208.37, 2853, 2591],
        ].map(
          ([designator, trueBearingDeg, magneticBearingDeg, toraM, ldaM]) => ({
            designator: designator as string,
            trueBearingDeg: trueBearingDeg as number,
            magneticBearingDeg: magneticBearingDeg as number,
            toraM: toraM as number,
            todaM: null,
            asdaM: null,
            ldaM: ldaM as number,
            thresholdElevationFt: null,
            displacedThreshold: designator === '21',
            remarks: null,
          }),
        ),
      },
    ],
    frequencies: [
      { service: 'TWR', callsign: 'NANTES Tour', mhz: '118.655' },
      { service: 'GND', callsign: 'NANTES Sol', mhz: '121.655' },
      { service: 'ATIS', callsign: 'NANTES', mhz: '126.930' },
    ],
    vacUrl:
      'https://www.sia.aviation-civile.gouv.fr/media/dvd/eAIP_01_OCT_2026/Atlas-VAC/PDF_AIPparSSection/VAC/AD/AD-2.LFRS.pdf',
    chartsUrl: 'https://www.sia.aviation-civile.gouv.fr/',
  };

  it('prints the aerodromes, the runway wind, the obstacles, the VFR points with their aerodrome and the freezing level', async () => {
    const point = {
      id: 'VRP:LFRN-S',
      type: 'VRP' as const,
      ident: 'S',
      name: 'S',
      lat: 47.75,
      lon: -1.7,
      elevationFt: null,
      frequency: null,
      aerodromeIcao: 'LFRN',
      mandatory: null,
    };
    const result = computeFlightPlan(
      engineInput({
        waypoints: [point],
        legs: [
          { altitudeFt: 2500, cruiseSetting: null, windOverride: null },
          { altitudeFt: 2500, cruiseSetting: null, windOverride: null },
        ],
        weather: [
          {
            icao: 'LFRS',
            metar: 'LFRS 161000Z 24012KT CAVOK 18/09 Q1015',
            taf: null,
            observedAt: new Date('2026-10-16T10:00:00Z'),
          },
        ],
        aerodromes: { departure: lfrs, destination: null },
        obstacles: [
          {
            ident: 'E1',
            type: 'Eolienne(s)',
            lat: 47.5,
            lon: -1.66,
            amslFt: 2150,
            aglFt: 500,
            count: 1,
            lighting: 'jour et nuit',
          },
        ],
        wind: () => ({
          fromDeg: 240,
          speedKt: 10,
          temperatureC: 5,
          validAt: null,
        }),
      }),
    );
    const text = pageText(
      await load(await buildDossierPdf(options(result))),
    ).join('\n');
    expect(text).toMatch(/LFRS - LFRN S - LFRN/);
    expect(text).toMatch(/^Terrains$/m);
    expect(text).toMatch(/^départ LFRS NANTES ATLANTIQUE — 90 ft$/m);
    expect(text).toMatch(/Ouvert à la circulation aérienne publique/);
    expect(text).toMatch(/TWR 118\.655 · GND 121\.655 · ATIS 126\.930/);
    expect(text).toMatch(/Carburant : UL91, JET A1/);
    expect(text).toMatch(/AD-2\.LFRS\.pdf/);
    expect(text).toMatch(
      /METAR : vent 240\/12 kt, 18 °C, QNH 1015 — altitude densité \d+ ft/,
    );
    // 21 (true 207.44): 240 is 32.6° to the right, 10 kt head and 6 kt across.
    expect(text).toMatch(/21 QFU 208/);
    expect(text).toMatch(/2591 m/);
    expect(text).toMatch(/\* 10 kt face, travers 6 kt de droite/);
    expect(text).toMatch(
      /Obstacles à moins de 500 ft sous l’altitude prévue, LFRS-LFRN S : Eolienne\(s\) 2150 ft/,
    );
    expect(text).toMatch(
      /Isotherme 0 °C \(prévision ICON-EU\) : LFRS > \d+ ft/,
    );
  });
});
