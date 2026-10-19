/*
 * Navigation data for the flight preparation (France: SIA open-licence
 * export; aerodromes elsewhere: OurAirports).
 *
 * Build a bundle (no database), on the operator's machine, once per AIRAC
 * cycle when the SIA publishes it (about three weeks before it applies):
 *   npm run navdata:build -- --sia XML_SIA_2026-10-29.zip --out navdata-2611.json.gz
 *     [--ourairports <dir with airports.csv, runways.csv, airport-frequencies.csv>
 *      | --download-ourairports] [--airac 2611]
 *   (without an OurAirports option, the aerodromes of the bundle shipped with
 *   the code are used for the countries around France)
 * The aerodromes-only bundle shipped with the code:
 *   npm run navdata:build -- --baseline --download-ourairports \
 *     --out src/modules/navdata/data/navdata-baseline.json.gz
 *
 * Import into a database (DATABASE_URL), on each installation:
 *   npm run navdata:import -- --sia <XML or zip> [same options as build]
 *   npm run navdata:import -- --file navdata-2611.json.gz [--sha256 <hex>]
 *   build option: --check-vac (asks the SIA, one HEAD request per aerodrome,
 *            whether its VAC of the cycle exists; stored in the bundle)
 *   options: --activate-now (do not wait for the effective date),
 *            --force (import a cycle that fails validation; never by default)
 * In the production image: node dist/scripts/navdata.js import --file ...
 * Or let the API do it: put the bundle (and its .sha256) in NAVDATA_DIR, or
 * publish them under NAVDATA_BUNDLE_URL; the API imports them every night
 * and activates the cycle on its effective date.
 */
import 'reflect-metadata';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import axios from 'axios';
import { DataSource } from 'typeorm';
import {
  buildBundle,
  decodeBundle,
  encodeBundle,
  sha256,
} from '../src/modules/navdata/import/bundle';
import {
  emptyReport,
  NavdataBundle,
} from '../src/modules/navdata/import/bundle-types';
import { validateBundle } from '../src/modules/navdata/import/validate';
import {
  OURAIRPORTS_BASE_URL,
  OurAirportsFiles,
} from '../src/modules/navdata/import/ourairports';
import {
  baselineBundlePath,
  NavdataImportService,
} from '../src/modules/navdata/import/navdata-import.service';
import {
  AirspaceEntity,
  NavdataCycle,
  NavPointEntity,
  ObstacleEntity,
} from '../src/modules/navdata/entity/navdata.entity';
import { vacUrl } from '../src/modules/navdata/import/vac';

const args = process.argv.slice(2);
const command = args[0];
const option = (name: string): string | null => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? (args[index + 1] ?? null) : null;
};
const flag = (name: string) => args.includes(`--${name}`);

async function ourAirports(): Promise<{
  files: OurAirportsFiles;
  downloadedAt: Date;
} | null> {
  const dir = option('ourairports');
  if (dir) {
    return {
      files: {
        airports: readFileSync(join(dir, 'airports.csv'), 'utf8'),
        runways: readFileSync(join(dir, 'runways.csv'), 'utf8'),
        frequencies: readFileSync(join(dir, 'airport-frequencies.csv'), 'utf8'),
      },
      downloadedAt: new Date(),
    };
  }
  if (flag('download-ourairports')) {
    const get = async (name: string) =>
      (
        await axios.get<string>(`${OURAIRPORTS_BASE_URL}/${name}`, {
          responseType: 'text',
          timeout: 120_000,
        })
      ).data;
    console.log(`Downloading OurAirports from ${OURAIRPORTS_BASE_URL}`);
    const [airports, runways, frequencies] = await Promise.all([
      get('airports.csv'),
      get('runways.csv'),
      get('airport-frequencies.csv'),
    ]);
    return {
      files: { airports, runways, frequencies },
      downloadedAt: new Date(),
    };
  }
  return null;
}

// Whether the VAC of each SIA aerodrome answers, a few requests at a time.
async function checkVac(bundle: NavdataBundle): Promise<void> {
  const effective = new Date(bundle.effectiveFrom);
  const aerodromes = bundle.points.filter(
    (p) =>
      p.type === 'AERODROME' &&
      p.source === 'SIA' &&
      p.extra?.info &&
      p.extra.info.status !== 'OFF',
  );
  let found = 0;
  for (let i = 0; i < aerodromes.length; i += 8) {
    await Promise.all(
      aerodromes.slice(i, i + 8).map(async (point) => {
        const info = point.extra!.info!;
        try {
          const response = await axios.head(vacUrl(point.ident, effective), {
            timeout: 20_000,
            validateStatus: () => true,
          });
          info.vac =
            response.status === 200 &&
            /pdf/i.test(String(response.headers['content-type'] ?? ''));
        } catch {
          // Unknown: the link is offered with the SIA home page.
          delete info.vac;
        }
        if (info.vac) found++;
      }),
    );
  }
  console.log(`VAC: ${found} of ${aerodromes.length} aerodromes have one`);
}

async function bundleFromArguments(): Promise<{
  bundle: NavdataBundle;
  data: Buffer;
}> {
  const file = option('file');
  if (file) {
    const data = readFileSync(file);
    return { bundle: decodeBundle(data, option('sha256')), data };
  }
  const siaFile = option('sia');
  if (!siaFile && !flag('baseline')) {
    throw new Error(
      'Give --sia <XML_SIA file or zip>, --file <bundle> or --baseline',
    );
  }
  const airports = await ourAirports();
  let shipped: { points: NavdataBundle['points']; downloadedAt: Date } | null =
    null;
  if (!airports) {
    const path = baselineBundlePath();
    if (path) {
      const baseline = decodeBundle(readFileSync(path));
      shipped = {
        points: baseline.points,
        downloadedAt: new Date(
          baseline.sources.ourAirports?.downloadedAt ?? baseline.builtAt,
        ),
      };
    }
  }
  const { bundle, report } = buildBundle({
    sia: siaFile
      ? { fileName: basename(siaFile), data: readFileSync(siaFile) }
      : null,
    ourAirports: airports,
    ourAirportsPoints: shipped,
    airac: option('airac'),
  });
  if (flag('check-vac')) await checkVac(bundle);
  // What the import will check (without the previous cycle to compare to).
  const validation = emptyReport();
  const accepted = validateBundle(bundle, null, validation);
  console.log(
    JSON.stringify(
      {
        counts: report.counts,
        skipped: report.skipped,
        warnings: report.warnings,
        errors: report.errors,
        validation: { accepted, errors: validation.errors },
      },
      null,
      2,
    ),
  );
  return { bundle, data: encodeBundle(bundle) };
}

async function main() {
  if (command !== 'build' && command !== 'import') {
    console.log(
      'Usage: navdata build|import [options] (see scripts/navdata.ts)',
    );
    process.exit(2);
  }
  const { bundle, data } = await bundleFromArguments();
  const out = option('out');
  if (out) {
    if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, data);
    writeFileSync(`${out}.sha256`, `${sha256(data)}  ${basename(out)}\n`);
    console.log(
      `Bundle AIRAC ${bundle.airac}: ${bundle.points.length} points, ${bundle.airspaces.length} airspaces -> ${out}`,
    );
  }
  if (command === 'build') return;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const dataSource = new DataSource({
    type: 'postgres',
    url,
    entities: [NavdataCycle, NavPointEntity, AirspaceEntity, ObstacleEntity],
  });
  await dataSource.initialize();
  try {
    const service = new NavdataImportService(dataSource, {
      invalidate: () => undefined,
    } as any);
    const outcome = await service.importBuffer(data, option('sha256'), {
      activateNow: flag('activate-now'),
      force: flag('force'),
    });
    console.log(`Import: ${outcome.status} (cycle ${outcome.cycleId ?? '-'})`);
    if (outcome.report.errors.length)
      console.log(outcome.report.errors.join('\n'));
    if (outcome.status === 'REJECTED') process.exitCode = 1;
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
