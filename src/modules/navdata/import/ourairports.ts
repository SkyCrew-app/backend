import { BundlePoint, BundleRunway, bump, ImportReport } from './bundle-types';
import { RadioFrequency } from '../../navplan/engine/airspace-intersection';

// OurAirports (https://ourairports.com/data/): aerodromes, runways and
// frequencies, "released to the Public Domain", without warranty. Used for
// the aerodromes outside France and the French fields the SIA export does
// not list (private strips), and for the runways and frequencies of an
// aerodrome when the SIA gives none.

export const OURAIRPORTS_BASE_URL =
  'https://davidmegginson.github.io/ourairports-data';
export const OURAIRPORTS_FILES = [
  'airports.csv',
  'runways.csv',
  'airport-frequencies.csv',
] as const;

// France and the countries a club flight from France may land in.
export const OURAIRPORTS_COUNTRIES = [
  'FR',
  'BE',
  'LU',
  'CH',
  'DE',
  'ES',
  'IT',
  'GB',
  'NL',
  'MC',
  'AD',
];

const AERODROME_TYPES = new Set([
  'small_airport',
  'medium_airport',
  'large_airport',
]);

// RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes.
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...data] = rows;
  if (!header) return [];
  return data
    .filter((r) => r.length > 1)
    .map((r) =>
      Object.fromEntries(header.map((name, i) => [name, r[i] ?? ''])),
    );
}

const num = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const FT_TO_M = 0.3048;

export interface OurAirportsFiles {
  airports: string;
  runways: string;
  frequencies: string;
}

export function parseOurAirports(
  files: OurAirportsFiles,
  report: ImportReport,
  countries: string[] = OURAIRPORTS_COUNTRIES,
): BundlePoint[] {
  const wanted = new Set(countries);
  const airports = parseCsv(files.airports).filter(
    (a) => wanted.has(a.iso_country) && AERODROME_TYPES.has(a.type),
  );
  const ids = new Set(airports.map((a) => a.id));
  const runways = new Map<string, BundleRunway[]>();
  for (const r of parseCsv(files.runways)) {
    if (!ids.has(r.airport_ref) || r.closed === '1') continue;
    const list = runways.get(r.airport_ref) ?? [];
    const length = num(r.length_ft);
    const width = num(r.width_ft);
    list.push({
      designator: [r.le_ident, r.he_ident].filter(Boolean).join('/'),
      trueHeadingDeg: num(r.le_heading_degT),
      lengthM: length === null ? null : Math.round(length * FT_TO_M),
      widthM: width === null ? null : Math.round(width * FT_TO_M),
      surface: r.surface || null,
    });
    runways.set(r.airport_ref, list);
  }
  const frequencies = new Map<string, RadioFrequency[]>();
  for (const f of parseCsv(files.frequencies)) {
    if (!ids.has(f.airport_ref)) continue;
    const mhz = num(f.frequency_mhz);
    if (mhz === null) continue;
    const list = frequencies.get(f.airport_ref) ?? [];
    list.push({
      service: f.type || 'FREQ',
      callsign: f.description || null,
      mhz: mhz.toFixed(3),
    });
    frequencies.set(f.airport_ref, list);
  }
  return airports.map((a) => {
    bump(report.counts, `OurAirports ${a.iso_country}`);
    const ident = a.icao_code || a.gps_code || a.ident;
    return {
      type: 'AERODROME' as const,
      ident,
      name: a.name || null,
      lat: Number(a.latitude_deg),
      lon: Number(a.longitude_deg),
      elevationFt: num(a.elevation_ft),
      frequency: null,
      country: a.iso_country,
      aerodromeIcao: null,
      mandatory: null,
      source: 'OURAIRPORTS' as const,
      sourceId: a.ident,
      extra: {
        runways: runways.get(a.id) ?? [],
        frequencies: frequencies.get(a.id) ?? [],
        status: a.type,
      },
    };
  });
}

// SIA aerodromes win for France; OurAirports adds the others and fills the
// runways and frequencies an SIA aerodrome lacks.
export function mergeAerodromes(
  sia: BundlePoint[],
  ourAirports: BundlePoint[],
): BundlePoint[] {
  const byIdent = new Map(
    sia.filter((p) => p.type === 'AERODROME').map((p) => [p.ident, p]),
  );
  const result = [...sia];
  for (const point of ourAirports) {
    const known = byIdent.get(point.ident);
    if (!known) {
      result.push(point);
      continue;
    }
    known.extra = known.extra ?? {};
    if (!known.extra.runways?.length)
      known.extra.runways = point.extra?.runways ?? [];
    if (!known.extra.frequencies?.length)
      known.extra.frequencies = point.extra?.frequencies ?? [];
  }
  return result;
}
