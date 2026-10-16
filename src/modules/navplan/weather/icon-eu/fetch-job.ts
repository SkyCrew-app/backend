import axios from 'axios';
import { spawnSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { readGrib2 } from './grib2';
import {
  encodeGrid,
  GRID_SCHEMA,
  GRID_VARIABLES,
  GridHeader,
  quantize,
  WINDS_ATTRIBUTION,
} from '../winds-grid';

// Builds the winds/temperatures grid from the DWD ICON-EU open data
// (https://opendata.dwd.de/weather/nwp/icon-eu/grib/, CC BY 4.0). Runs as
// its own process (decompressing and decoding a few hundred GRIB2 files
// would hold the API's event loop): spawned twice a day by the API when
// WINDS_ALOFT_FETCH=true, or run by hand:
//   node dist/src/modules/navplan/weather/icon-eu/fetch-job.js [dir]
// The .bz2 files are decompressed with the system `bzcat` (present in the
// node:alpine image through busybox, and on macOS/Linux).

const BASE_URL =
  process.env.ICON_EU_BASE_URL ??
  'https://opendata.dwd.de/weather/nwp/icon-eu/grib';
const LEVELS = [1000, 950, 925, 850, 700, 600]; // hPa: surface to about FL140
// France and neighbours, every 0.125 degree (the model grid is 0.0625).
const AREA = { lat0: 41, lat1: 52, lon0: -6, lon1: 10, step: 0.125 };
const KEEP_FILES = 3;

export interface FetchOptions {
  dir: string;
  steps?: number[];
  levels?: number[];
  run?: Date;
  log?: (message: string) => void;
}

const pad = (n: number, size: number) => String(n).padStart(size, '0');
const runStamp = (run: Date) =>
  `${run.getUTCFullYear()}${pad(run.getUTCMonth() + 1, 2)}${pad(run.getUTCDate(), 2)}${pad(run.getUTCHours(), 2)}`;

export const fileUrl = (
  run: Date,
  step: number,
  level: number,
  variable: string,
) =>
  `${BASE_URL}/${pad(run.getUTCHours(), 2)}/${variable}/icon-eu_europe_regular-lat-lon_pressure-level_${runStamp(run)}_${pad(step, 3)}_${level}_${variable.toUpperCase()}.grib2.bz2`;

const defaultSteps = () => {
  const hours = Number(process.env.WINDS_ALOFT_HOURS) || 36;
  return Array.from({ length: Math.floor(hours / 3) + 1 }, (_, i) => i * 3);
};

// The latest 00/06/12/18 UTC run whose last needed file is published.
export async function latestRun(now: Date, lastStep: number): Promise<Date> {
  const base = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      Math.floor(now.getUTCHours() / 6) * 6,
    ),
  );
  for (let back = 0; back < 5; back++) {
    const run = new Date(base.getTime() - back * 6 * 3_600_000);
    try {
      await axios.head(fileUrl(run, lastStep, LEVELS[LEVELS.length - 1], 't'), {
        timeout: 15_000,
      });
      return run;
    } catch {
      // not yet published
    }
  }
  throw new Error('No complete ICON-EU run found');
}

const decompress = (data: Buffer): Buffer => {
  // A fixed path, so that the job never runs whatever "bzcat" comes first in the PATH.
  const result = spawnSync(process.env.BZCAT_PATH ?? '/usr/bin/bzcat', [], {
    input: data,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0 || !result.stdout?.length) {
    throw new Error(
      `bzcat failed: ${result.stderr?.toString() || result.error?.message}`,
    );
  }
  return result.stdout;
};

export async function runWindsFetch(options: FetchOptions): Promise<string> {
  const log = options.log ?? ((message: string) => console.log(message));
  const steps = options.steps ?? defaultSteps();
  const levels = options.levels ?? LEVELS;
  const run =
    options.run ?? (await latestRun(new Date(), steps[steps.length - 1]));
  const nLat = Math.round((AREA.lat1 - AREA.lat0) / AREA.step) + 1;
  const nLon = Math.round((AREA.lon1 - AREA.lon0) / AREA.step) + 1;
  const header: GridHeader = {
    schema: GRID_SCHEMA,
    model: 'ICON-EU',
    run: run.toISOString(),
    steps,
    levels,
    lat0: AREA.lat0,
    lon0: AREA.lon0,
    dLat: AREA.step,
    dLon: AREA.step,
    nLat,
    nLon,
    createdAt: new Date().toISOString(),
    attribution: WINDS_ATTRIBUTION,
  };
  const data = new Int16Array(
    steps.length * levels.length * GRID_VARIABLES.length * nLat * nLon,
  );
  const jobs: { step: number; level: number; variable: number }[] = [];
  steps.forEach((_, step) =>
    levels.forEach((__, level) =>
      GRID_VARIABLES.forEach((___, variable) =>
        jobs.push({ step, level, variable }),
      ),
    ),
  );
  log(`ICON-EU run ${run.toISOString()}: ${jobs.length} files`);

  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const url = fileUrl(
        run,
        steps[job.step],
        levels[job.level],
        GRID_VARIABLES[job.variable],
      );
      const response = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: 120_000,
      });
      const field = readGrib2(decompress(Buffer.from(response.data)));
      const base =
        ((job.step * levels.length + job.level) * GRID_VARIABLES.length +
          job.variable) *
        nLat *
        nLon;
      for (let y = 0; y < nLat; y++) {
        const j = Math.round(
          (AREA.lat0 + y * AREA.step - field.lat1) / field.dLat,
        );
        for (let x = 0; x < nLon; x++) {
          const i = Math.round(
            (AREA.lon0 + x * AREA.step - field.lon1) / field.dLon,
          );
          if (j < 0 || j >= field.nj || i < 0 || i >= field.ni)
            throw new Error('Area outside the model grid');
          data[base + y * nLon + x] = quantize(
            GRID_VARIABLES[job.variable],
            field.values[j * field.ni + i],
          );
        }
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));

  mkdirSync(options.dir, { recursive: true });
  const name = `winds-icon-eu-${runStamp(run)}.bin.gz`;
  const temporary = join(options.dir, `${name}.part`);
  writeFileSync(temporary, encodeGrid({ header, data }));
  renameSync(temporary, join(options.dir, name));
  // Keep the last few runs only.
  const files = readdirSync(options.dir)
    .filter((f) => /^winds-icon-eu-\d{10}\.bin\.gz$/.test(f))
    .sort();
  for (const old of files.slice(0, Math.max(0, files.length - KEEP_FILES)))
    unlinkSync(join(options.dir, old));
  log(`Written ${name}`);
  return join(options.dir, name);
}

export const windsDir = () =>
  process.env.WINDS_DIR ?? join(process.cwd(), 'data', 'winds');

if (require.main === module) {
  // The folder comes from the environment only (WINDS_DIR), never from arguments.
  const dir = windsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  runWindsFetch({ dir })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`Winds fetch failed: ${(error as Error)?.message}`);
      process.exit(1);
    });
}
