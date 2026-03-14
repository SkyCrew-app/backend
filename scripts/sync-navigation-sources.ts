import { existsSync, readFileSync, writeFileSync } from 'fs';
import { request as httpsRequest, get } from 'https';
import { resolve } from 'path';

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

const OPENAIP_API_KEY = process.env.OPENAIP_API_KEY || '';
const OPENAIP_BASE = 'https://api.core.openaip.net/api';
const OPENAIP_COUNTRIES = (process.env.OPENAIP_COUNTRIES || 'FR')
  .split(',')
  .map((c) => c.trim().toUpperCase())
  .filter(Boolean);

const dataDir = resolve(__dirname, '../src/modules/flights/data');

/* ------------------------------------------------------------------ */
/*  Interfaces (matching navigation.interface.ts)                      */
/* ------------------------------------------------------------------ */

interface NavaidData {
  ident: string;
  name: string;
  type: 'VOR' | 'NDB' | 'FIX';
  country: string;
  lat: number;
  lon: number;
}

interface AirspaceZoneData {
  id: string;
  name: string;
  class: string;
  floor_ft: number;
  ceiling_ft: number;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/* ------------------------------------------------------------------ */
/*  OpenAIP type enums                                                 */
/* ------------------------------------------------------------------ */

// 0=DME, 1=TACAN, 2=NDB, 3=VOR, 4=VOR-DME, 5=VORTAC, 6=DVOR, 7=DVOR-DME, 8=DVORTAC
const NAVAID_TYPE_MAP: Record<number, 'VOR' | 'NDB' | null> = {
  0: null,
  1: null,
  2: 'NDB',
  3: 'VOR',
  4: 'VOR',
  5: 'VOR',
  6: 'VOR',
  7: 'VOR',
  8: 'VOR',
};

const ICAO_CLASS_MAP: Record<number, string> = {
  0: 'A',
  1: 'B',
  2: 'C',
  3: 'D',
  4: 'E',
  5: 'F',
  6: 'G',
  8: 'SUA',
};

// Types d'espace aérien restrictifs à importer
const RESTRICTED_AIRSPACE_TYPES = new Set([
  1, // Restricted
  2, // Danger
  3, // Prohibited
  17, // Alert Area
  18, // Warning Area
  19, // Protected Area
]);

/* ------------------------------------------------------------------ */
/*  HTTP helpers                                                       */
/* ------------------------------------------------------------------ */

function fetchJson(
  url: string,
  headers: Record<string, string> = {},
): Promise<any> {
  return new Promise((resolveData, reject) => {
    const parsedUrl = new URL(url);
    const req = httpsRequest(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: { Accept: 'application/json', ...headers },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            reject(
              new Error(`HTTP ${res.statusCode} for ${url} — ${body.slice(0, 200)}`),
            );
          });
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            resolveData(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch {
            reject(new Error(`Invalid JSON from ${url}`));
          }
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function fetchAllPages(
  endpoint: string,
  params: Record<string, string>,
): Promise<any[]> {
  const headers = { 'x-openaip-api-key': OPENAIP_API_KEY };
  const allItems: any[] = [];
  let page = 1;
  const limit = 1000;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = new URLSearchParams({
      ...params,
      page: String(page),
      limit: String(limit),
    });
    const url = `${OPENAIP_BASE}${endpoint}?${query}`;
    const response = await fetchJson(url, headers);

    const items = response.items ?? response;
    if (!Array.isArray(items) || items.length === 0) break;

    allItems.push(...items);
    if (items.length < limit) break;
    page += 1;
  }

  return allItems;
}

/* ------------------------------------------------------------------ */
/*  Transform OpenAIP → format interne                                 */
/* ------------------------------------------------------------------ */

function transformNavaid(raw: any): NavaidData | null {
  const mappedType = NAVAID_TYPE_MAP[raw.type];
  if (!mappedType) return null;

  const coords = raw.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;

  return {
    ident:
      raw.identifier ||
      raw.name?.substring(0, 5)?.toUpperCase() ||
      'UNK',
    name: raw.name || 'Unknown',
    type: mappedType,
    country: Array.isArray(raw.country) ? raw.country[0] : raw.country,
    lat: coords[1], // GeoJSON: [lon, lat]
    lon: coords[0],
  };
}

function altitudeToFeet(limit: any): number {
  if (!limit) return 0;
  const value = limit.value ?? 0;
  const unit = limit.unit ?? 1;

  if (unit === 0) return Math.round(value * 3.28084); // meters → feet
  if (unit === 6) return value * 100; // flight level → feet
  return value; // already feet
}

function transformAirspace(raw: any): AirspaceZoneData | null {
  if (!RESTRICTED_AIRSPACE_TYPES.has(raw.type)) return null;

  const coords = raw.geometry?.coordinates;
  if (!coords || !coords[0] || coords[0].length < 3) return null;

  // Bounding box depuis le polygone GeoJSON
  const ring = coords[0] as number[][];
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;

  for (const [lon, lat] of ring) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }

  return {
    id: raw._id || `airspace-${raw.name}`,
    name: raw.name || 'Unknown',
    class: ICAO_CLASS_MAP[raw.icaoClass] ?? 'SUA',
    floor_ft: altitudeToFeet(raw.lowerLimit),
    ceiling_ft: altitudeToFeet(raw.upperLimit),
    minLat,
    maxLat,
    minLon,
    maxLon,
  };
}

/* ------------------------------------------------------------------ */
/*  OurAirports CSV                                                    */
/* ------------------------------------------------------------------ */

function download(url: string): Promise<string> {
  return new Promise((resolveData, reject) => {
    get(url, (response) => {
      if (response.statusCode && response.statusCode >= 400) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () =>
        resolveData(Buffer.concat(chunks).toString('utf8')),
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
/*  Main sync                                                          */
/* ------------------------------------------------------------------ */

async function syncSources(): Promise<void> {
  const countries = OPENAIP_COUNTRIES.join(', ');

  // 1. OurAirports (CSV)
  try {
    const csv = await download(
      'https://davidmegginson.github.io/ourairports-data/airports.csv',
    );
    const rows = parseCsv(csv);
    const outFile = resolve(dataDir, 'airports.source.json');
    writeFileSync(outFile, JSON.stringify(rows));
    // eslint-disable-next-line no-console
    console.log(`[ok] OurAirports -> ${outFile} (${rows.length} rows)`);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.warn(`[warn] OurAirports unavailable: ${error.message}`);
  }

  // 2. OpenAIP Navaids (API REST)
  if (OPENAIP_API_KEY) {
    try {
      const allNavaids: NavaidData[] = [];

      for (const country of OPENAIP_COUNTRIES) {
        const raw = await fetchAllPages('/navaids', { country });
        const transformed = raw
          .map(transformNavaid)
          .filter((n): n is NavaidData => n !== null);
        allNavaids.push(...transformed);
        // eslint-disable-next-line no-console
        console.log(
          `  [fetch] Navaids ${country}: ${transformed.length} usable (from ${raw.length} raw)`,
        );
      }

      if (allNavaids.length > 0) {
        const outFile = resolve(dataDir, 'navaids.fr.json');
        writeFileSync(outFile, JSON.stringify(allNavaids, null, 2));
        // eslint-disable-next-line no-console
        console.log(
          `[ok] OpenAIP Navaids (${countries}) -> ${outFile} (${allNavaids.length} records)`,
        );
      } else {
        // eslint-disable-next-line no-console
        console.log(
          `[skip] OpenAIP Navaids: 0 records returned, keeping existing file`,
        );
      }
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.warn(`[warn] OpenAIP Navaids failed: ${error.message}`);
    }
  } else {
    // eslint-disable-next-line no-console
    console.log('[skip] OpenAIP Navaids (OPENAIP_API_KEY not configured)');
  }

  // 3. OpenAIP Airspaces (API REST)
  if (OPENAIP_API_KEY) {
    try {
      const allAirspaces: AirspaceZoneData[] = [];

      for (const country of OPENAIP_COUNTRIES) {
        const raw = await fetchAllPages('/airspaces', { country });
        const transformed = raw
          .map(transformAirspace)
          .filter((a): a is AirspaceZoneData => a !== null);
        allAirspaces.push(...transformed);
        // eslint-disable-next-line no-console
        console.log(
          `  [fetch] Airspaces ${country}: ${transformed.length} restricted (from ${raw.length} total)`,
        );
      }

      if (allAirspaces.length > 0) {
        const outFile = resolve(dataDir, 'airspaces.fr.json');
        writeFileSync(outFile, JSON.stringify(allAirspaces, null, 2));
        // eslint-disable-next-line no-console
        console.log(
          `[ok] OpenAIP Airspaces (${countries}) -> ${outFile} (${allAirspaces.length} records)`,
        );
      } else {
        // eslint-disable-next-line no-console
        console.log(
          `[skip] OpenAIP Airspaces: 0 records returned, keeping existing file`,
        );
      }
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.warn(`[warn] OpenAIP Airspaces failed: ${error.message}`);
    }
  } else {
    // eslint-disable-next-line no-console
    console.log('[skip] OpenAIP Airspaces (OPENAIP_API_KEY not configured)');
  }

  // Vérification fichiers finaux
  // eslint-disable-next-line no-console
  console.log('');
  const requiredFiles = [
    resolve(dataDir, 'airports.json'),
    resolve(dataDir, 'navaids.fr.json'),
    resolve(dataDir, 'airspaces.fr.json'),
  ];

  for (const filePath of requiredFiles) {
    if (!existsSync(filePath)) {
      throw new Error(`Required local dataset missing: ${filePath}`);
    }

    const count = JSON.parse(readFileSync(filePath, 'utf-8')).length;
    // eslint-disable-next-line no-console
    console.log(`[ready] ${filePath} (${count} records)`);
  }
}

syncSources().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
