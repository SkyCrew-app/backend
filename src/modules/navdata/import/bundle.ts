import { createHash } from 'crypto';
import { gunzipSync, gzipSync } from 'zlib';
import { airacCycleAt, airacCycleByIdent } from './airac';
import {
  BUNDLE_SCHEMA,
  BundlePoint,
  emptyReport,
  ImportReport,
  NavdataBundle,
} from './bundle-types';
import {
  mergeAerodromes,
  OurAirportsFiles,
  parseOurAirports,
} from './ourairports';
import { mergeAixmRunwayEnds, parseAixmRunwayEnds } from './aixm.parser';
import { parseSiaXml } from './sia-xml.parser';
import { decodeXmlBuffer } from './xml';
import { readZip } from './zip';

export const sha256 = (data: Buffer): string =>
  createHash('sha256').update(data).digest('hex');

export const encodeBundle = (bundle: NavdataBundle): Buffer =>
  gzipSync(Buffer.from(JSON.stringify(bundle)), { level: 9 });

export class BundleError extends Error {}

export function decodeBundle(
  data: Buffer,
  expectedSha256?: string | null,
): NavdataBundle {
  if (expectedSha256 && sha256(data) !== expectedSha256.trim().toLowerCase()) {
    throw new BundleError('SHA-256 of the bundle does not match');
  }
  const bundle = JSON.parse(gunzipSync(data).toString('utf8')) as NavdataBundle;
  // Schema 1 is still read for aerodromes-only bundles (no airspace).
  const readable =
    bundle.schema === BUNDLE_SCHEMA ||
    (bundle.schema === 1 && !bundle.sources?.sia);
  if (!readable) {
    throw new BundleError(
      `Bundle schema ${bundle.schema} is not ${BUNDLE_SCHEMA}${bundle.schema === 1 ? ' (SIA data built before the unknown-outline rule: rebuild it)' : ''}`,
    );
  }
  return bundle;
}

// The SIA XML out of the downloaded zip, or the XML file itself; with the
// AIXM 4.5 file of the zip when it is there (declared distances, QFU).
export function siaXmlOf(
  fileName: string,
  data: Buffer,
): { name: string; xml: string; aixm: string | null } {
  if (data.readUInt32LE(0) === 0x04034b50) {
    const entries = readZip(data);
    const entry = entries.find((e) => /XML_SIA_[\d-]+\.xml$/i.test(e.name));
    if (!entry) throw new BundleError(`No XML_SIA_*.xml in ${fileName}`);
    const aixm = entries.find((e) => /AIXM[^/]*\.xml$/i.test(e.name));
    return {
      name: entry.name,
      xml: decodeXmlBuffer(entry.read()),
      aixm: aixm ? decodeXmlBuffer(aixm.read()) : null,
    };
  }
  return { name: fileName, xml: decodeXmlBuffer(data), aixm: null };
}

export interface BuildOptions {
  sia?: { fileName: string; data: Buffer } | null;
  ourAirports?: { files: OurAirportsFiles; downloadedAt: Date } | null;
  // Already parsed OurAirports aerodromes (from a previous bundle).
  ourAirportsPoints?: { points: BundlePoint[]; downloadedAt: Date } | null;
  airac?: string | null;
  now?: Date;
}

const SIA_ATTRIBUTION = (date: string) =>
  `Service de l'Information Aéronautique – Données originales téléchargées sur https://www.sia.aviation-civile.gouv.fr, mise à jour du ${date}`;
const OURAIRPORTS_ATTRIBUTION = (date: string) =>
  `OurAirports (domaine public), téléchargé le ${date}`;

export function buildBundle(options: BuildOptions): {
  bundle: NavdataBundle;
  report: ImportReport;
} {
  const report = emptyReport();
  const now = options.now ?? new Date();
  let points: BundlePoint[] = [];
  const airspaces: NavdataBundle['airspaces'] = [];
  const obstacles: NonNullable<NavdataBundle['obstacles']> = [];
  const sources: NavdataBundle['sources'] = {};
  const attribution: string[] = [];

  let effective: Date | null = null;
  if (options.sia) {
    const { name, xml, aixm } = siaXmlOf(
      options.sia.fileName,
      options.sia.data,
    );
    const parsed = parseSiaXml(xml, report);
    points = parsed.points;
    airspaces.push(...parsed.airspaces);
    obstacles.push(...parsed.obstacles);
    if (aixm) mergeAixmRunwayEnds(points, parseAixmRunwayEnds(aixm), report);
    else
      report.warnings.push(
        'No AIXM 4.5 file next to the XML SIA: runways without TORA/TODA/ASDA and magnetic QFU',
      );
    const fileDate = /(\d{4}-\d{2}-\d{2})/.exec(name)?.[1] ?? null;
    const effectiveDate = parsed.effectiveDate ?? fileDate;
    sources.sia = { file: name, effectiveDate, version: parsed.version };
    if (effectiveDate)
      effective = new Date(`${effectiveDate.slice(0, 10)}T00:00:00Z`);
    attribution.push(SIA_ATTRIBUTION(effectiveDate ?? '?'));
  }
  if (options.ourAirports) {
    const extra = parseOurAirports(options.ourAirports.files, report);
    points = mergeAerodromes(points, extra);
    const day = options.ourAirports.downloadedAt.toISOString().slice(0, 10);
    sources.ourAirports = {
      downloadedAt: options.ourAirports.downloadedAt.toISOString(),
    };
    attribution.push(OURAIRPORTS_ATTRIBUTION(day));
  } else if (options.ourAirportsPoints) {
    points = mergeAerodromes(
      points,
      options.ourAirportsPoints.points.filter(
        (p) => p.source === 'OURAIRPORTS',
      ),
    );
    const day = options.ourAirportsPoints.downloadedAt
      .toISOString()
      .slice(0, 10);
    sources.ourAirports = {
      downloadedAt: options.ourAirportsPoints.downloadedAt.toISOString(),
    };
    attribution.push(OURAIRPORTS_ATTRIBUTION(day));
  }

  const cycle =
    (options.airac ? airacCycleByIdent(options.airac) : null) ??
    airacCycleAt(effective ?? now);
  if (effective && cycle.effectiveFrom.getTime() !== effective.getTime()) {
    report.warnings.push(
      `The SIA file is effective on ${effective.toISOString().slice(0, 10)}, AIRAC ${cycle.ident} starts on ${cycle.effectiveFrom.toISOString().slice(0, 10)}`,
    );
  }
  return {
    bundle: {
      schema: BUNDLE_SCHEMA,
      airac: cycle.ident,
      effectiveFrom: cycle.effectiveFrom.toISOString(),
      effectiveTo: cycle.effectiveTo.toISOString(),
      source: attribution.join(' ; '),
      builtAt: now.toISOString(),
      sources,
      points,
      airspaces,
      obstacles,
    },
    report,
  };
}
