import { writeFileSync } from 'fs';
import { get } from 'https';
import { resolve } from 'path';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AirportType = 'large_airport' | 'medium_airport' | 'small_airport';

interface RunwayDetail {
  le_ident: string;
  he_ident: string;
  length_ft: number;
  width_ft: number;
  surface: string;
  lighted: boolean;
}

interface FrequencyEntry {
  type: string;
  value: string;
}

interface AirportData {
  icao: string;
  iata: string | null;
  name: string;
  city: string | null;
  country: string | null;
  lat: number;
  lon: number;
  elevation_ft: number | null;
  type: AirportType;
  continent: string | null;
  runways: string[];
  runway_details: RunwayDetail[];
  frequencies: FrequencyEntry[];
}

/* ------------------------------------------------------------------ */
/*  URLs                                                               */
/* ------------------------------------------------------------------ */

const OUR_AIRPORTS_URL =
  'https://davidmegginson.github.io/ourairports-data/airports.csv';
const RUNWAYS_URL =
  'https://davidmegginson.github.io/ourairports-data/runways.csv';
const FREQUENCIES_URL =
  'https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv';

const OUTPUT_PATH = resolve(
  __dirname,
  '../src/modules/flights/data/airports.json',
);

/* ------------------------------------------------------------------ */
/*  HTTP + CSV                                                         */
/* ------------------------------------------------------------------ */

function downloadCsv(url: string): Promise<string> {
  return new Promise((resolveCsv, reject) => {
    get(url, (response) => {
      // Follow redirects (301/302)
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        downloadCsv(response.headers.location).then(resolveCsv).catch(reject);
        return;
      }
      if (response.statusCode && response.statusCode >= 400) {
        reject(new Error(`Unable to download CSV (${response.statusCode})`));
        return;
      }
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () =>
        resolveCsv(Buffer.concat(chunks).toString('utf8')),
      );
      response.on('error', reject);
    }).on('error', reject);
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function parseCsv(csv: string): Array<Record<string, string>> {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return Object.fromEntries(
      headers.map((header, i) => [header, cols[i] || '']),
    );
  });
}

/* ------------------------------------------------------------------ */
/*  Parsing airports                                                   */
/* ------------------------------------------------------------------ */

function toBaseAirports(
  csv: string,
): Omit<AirportData, 'runways' | 'runway_details' | 'frequencies'>[] {
  const rows = parseCsv(csv);

  return rows
    .filter((data) =>
      ['large_airport', 'medium_airport', 'small_airport'].includes(data.type),
    )
    .filter((data) => data.ident && data.latitude_deg && data.longitude_deg)
    .map((data) => ({
      icao: data.ident.toUpperCase(),
      iata: data.iata_code ? data.iata_code.toUpperCase() : null,
      name: data.name || data.ident.toUpperCase(),
      city: data.municipality || null,
      country: data.iso_country || null,
      lat: Number(data.latitude_deg),
      lon: Number(data.longitude_deg),
      elevation_ft: data.elevation_ft ? Number(data.elevation_ft) : null,
      type: data.type as AirportType,
      continent: data.continent || null,
    }));
}

/* ------------------------------------------------------------------ */
/*  Parsing runways                                                    */
/* ------------------------------------------------------------------ */

function parseRunways(csv: string): Map<string, RunwayDetail[]> {
  const rows = parseCsv(csv);
  const map = new Map<string, RunwayDetail[]>();

  for (const row of rows) {
    if (row.closed === '1') continue;

    const icao = (row.airport_ident || '').toUpperCase();
    if (!icao) continue;

    const detail: RunwayDetail = {
      le_ident: row.le_ident || '',
      he_ident: row.he_ident || '',
      length_ft: Number(row.length_ft) || 0,
      width_ft: Number(row.width_ft) || 0,
      surface: row.surface || 'UNKNOWN',
      lighted: row.lighted === '1',
    };

    if (!detail.le_ident && !detail.he_ident) continue;

    const existing = map.get(icao) || [];
    existing.push(detail);
    map.set(icao, existing);
  }

  return map;
}

function buildRunwayIdentifiers(details?: RunwayDetail[]): string[] {
  if (!details || details.length === 0) return [];
  return details.map((d) => {
    if (d.le_ident && d.he_ident) return `${d.le_ident}/${d.he_ident}`;
    return d.le_ident || d.he_ident;
  });
}

/* ------------------------------------------------------------------ */
/*  Parsing frequencies                                                */
/* ------------------------------------------------------------------ */

function parseFrequencies(csv: string): Map<string, FrequencyEntry[]> {
  const rows = parseCsv(csv);
  const map = new Map<string, FrequencyEntry[]>();

  for (const row of rows) {
    const icao = (row.airport_ident || '').toUpperCase();
    if (!icao) continue;

    const freqValue = row.frequency_mhz;
    if (!freqValue) continue;

    const entry: FrequencyEntry = {
      type: row.type || 'OTHER',
      value: freqValue,
    };

    const existing = map.get(icao) || [];
    existing.push(entry);
    map.set(icao, existing);
  }

  return map;
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function buildAirportDb(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Downloading airports, runways, and frequencies...');

  const [airportsCsv, runwaysCsv, frequenciesCsv] = await Promise.all([
    downloadCsv(OUR_AIRPORTS_URL),
    downloadCsv(RUNWAYS_URL),
    downloadCsv(FREQUENCIES_URL),
  ]);

  // eslint-disable-next-line no-console
  console.log('Parsing CSVs...');

  const baseAirports = toBaseAirports(airportsCsv);
  const runwaysMap = parseRunways(runwaysCsv);
  const frequenciesMap = parseFrequencies(frequenciesCsv);

  let withRunways = 0;
  let withFrequencies = 0;

  const enrichedAirports: AirportData[] = baseAirports.map((airport) => {
    const details = runwaysMap.get(airport.icao) ?? [];
    const frequencies = frequenciesMap.get(airport.icao) ?? [];

    if (details.length > 0) withRunways++;
    if (frequencies.length > 0) withFrequencies++;

    return {
      ...airport,
      runways: buildRunwayIdentifiers(details),
      runway_details: details,
      frequencies,
    };
  });

  writeFileSync(OUTPUT_PATH, JSON.stringify(enrichedAirports));

  // eslint-disable-next-line no-console
  console.log(
    `Airport DB generated: ${enrichedAirports.length} entries -> ${OUTPUT_PATH}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `  With runways: ${withRunways} | With frequencies: ${withFrequencies}`,
  );
}

buildAirportDb().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
