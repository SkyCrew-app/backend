import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import axios from 'axios';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { DataSource, EntityManager } from 'typeorm';
import {
  AirspaceEntity,
  NavdataCycle,
  NavPointEntity,
} from '../entity/navdata.entity';
import { NavdataService } from '../navdata.service';
import { airacCycleAt, nextAiracCycle } from './airac';
import { ImportReport, NavdataBundle, emptyReport } from './bundle-types';
import { decodeBundle, sha256 } from './bundle';
import {
  PreviousCycleSummary,
  REFERENCE_AERODROMES,
  validateBundle,
} from './validate';
import { CLUB_TIME_ZONE } from '../../reservations/booking-rules';
import { UNLOCATED_BOX } from '../../navplan/engine/airspace-intersection';

// Loads the navigation data bundles into the database and switches cycles
// on their effective date.
//   - At start-up, an installation without any data gets the aerodromes
//     shipped with the code (OurAirports, no airspace): the planner works,
//     every plan says the airspaces are not checked.
//   - Every day at 03:00 the bundles found in NAVDATA_DIR (or under
//     NAVDATA_BUNDLE_URL) are imported as STAGED, then the cycle that is due
//     becomes ACTIVE at 00:00 UTC of its effective date.
// Nothing here may stop the API: failures are logged and the data in force
// stays.

export const BASELINE_FILE = 'navdata-baseline.json.gz';
const LOCK_KEY = 1797_0001;
const CHUNK = 500;

// Without an outline the box is the published point, or the whole world
// when the area cannot be located (see referencePointOf).
export const bboxOf = (
  geometry: number[][][][],
  referencePoint?: { lat: number; lon: number } | null,
) => {
  if (geometry.length === 0) {
    const box = referencePoint
      ? {
          minLat: referencePoint.lat,
          maxLat: referencePoint.lat,
          minLon: referencePoint.lon,
          maxLon: referencePoint.lon,
        }
      : UNLOCATED_BOX;
    return {
      min_lat: box.minLat,
      max_lat: box.maxLat,
      min_lon: box.minLon,
      max_lon: box.maxLon,
    };
  }
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const polygon of geometry)
    for (const ring of polygon)
      for (const [lon, lat] of ring) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
      }
  return { min_lat: minLat, max_lat: maxLat, min_lon: minLon, max_lon: maxLon };
};

export const baselineBundlePath = (): string | null => {
  const candidates = [
    join(__dirname, '..', 'data', BASELINE_FILE),
    join(process.cwd(), 'src', 'modules', 'navdata', 'data', BASELINE_FILE),
    join(
      process.cwd(),
      'dist',
      'src',
      'modules',
      'navdata',
      'data',
      BASELINE_FILE,
    ),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
};

export interface ImportOutcome {
  cycleId: number | null;
  status: NavdataCycle['status'] | 'SKIPPED';
  report: ImportReport;
}

@Injectable()
export class NavdataImportService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NavdataImportService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly navdata: NavdataService,
  ) {}

  // The first import (a few thousand aerodromes) takes a few seconds; a
  // failure is reported and never stops the API.
  async onApplicationBootstrap(): Promise<void> {
    if (
      process.env.NAVDATA_AUTO_IMPORT === 'false' ||
      process.env.NODE_ENV === 'test'
    )
      return;
    try {
      await this.ensureData();
    } catch (error) {
      this.logger.error(
        `Navigation data not prepared: ${(error as Error)?.message}`,
      );
    }
  }

  async ensureData(now = new Date()): Promise<void> {
    await this.activateDue(now);
    const active = await this.dataSource
      .getRepository(NavdataCycle)
      .count({ where: { status: 'ACTIVE' } });
    if (active > 0) return;
    const path = baselineBundlePath();
    if (!path) {
      this.logger.warn(
        'No navigation data and no baseline bundle: the planner has no aerodromes',
      );
      return;
    }
    const outcome = await this.importBuffer(readFileSync(path), null, {
      now,
      activateNow: true,
    });
    this.logger.log(
      `Baseline aerodromes imported (${outcome.status}, ${outcome.report.counts.points ?? 0} points)`,
    );
  }

  private async previousSummary(
    manager: EntityManager,
  ): Promise<PreviousCycleSummary | null> {
    const active = await manager.getRepository(NavdataCycle).findOne({
      where: { status: 'ACTIVE', has_sia: true },
      order: { effective_from: 'DESC' },
    });
    if (!active) return null;
    const counts: { type: string; count: string }[] = await manager.query(
      `SELECT "type", count(*)::text AS count FROM "airspaces" WHERE "cycle_id" = $1 GROUP BY "type"`,
      [active.id],
    );
    const aerodromes: { ident: string; lat: number; lon: number }[] =
      await manager.query(
        `SELECT "ident", "lat", "lon" FROM "nav_points" WHERE "cycle_id" = $1 AND "type" = 'AERODROME' AND "ident" = ANY($2)`,
        [active.id, REFERENCE_AERODROMES],
      );
    return {
      airspaceCountByType: Object.fromEntries(
        counts.map((c) => [c.type, Number(c.count)]),
      ),
      aerodromes: Object.fromEntries(
        aerodromes.map((a) => [
          a.ident,
          { lat: Number(a.lat), lon: Number(a.lon) },
        ]),
      ),
    };
  }

  async importBuffer(
    data: Buffer,
    expectedSha256: string | null,
    options: { now?: Date; activateNow?: boolean; force?: boolean } = {},
  ): Promise<ImportOutcome> {
    const now = options.now ?? new Date();
    const digest = sha256(data);
    const known = await this.dataSource
      .getRepository(NavdataCycle)
      .findOne({ where: { sha256: digest } });
    if (known) {
      return { cycleId: known.id, status: 'SKIPPED', report: emptyReport() };
    }
    const bundle = decodeBundle(data, expectedSha256);
    return this.importBundle(bundle, digest, { ...options, now });
  }

  async importBundle(
    bundle: NavdataBundle,
    digest: string | null,
    options: { now?: Date; activateNow?: boolean; force?: boolean } = {},
  ): Promise<ImportOutcome> {
    const now = options.now ?? new Date();
    const report: ImportReport = emptyReport();
    const outcome = await this.dataSource.transaction(async (manager) => {
      const locked: { locked: boolean }[] = await manager.query(
        'SELECT pg_try_advisory_xact_lock($1) AS locked',
        [LOCK_KEY],
      );
      if (!locked[0]?.locked) {
        report.warnings.push('Another import is running');
        return { cycleId: null, status: 'SKIPPED' as const, report };
      }
      const valid = validateBundle(
        bundle,
        await this.previousSummary(manager),
        report,
      );
      const hasSia = !!bundle.sources.sia;
      const accepted = valid || !!options.force;
      if (!valid && options.force)
        report.warnings.push('Imported despite validation errors (--force)');
      const cycle = await manager.getRepository(NavdataCycle).save({
        airac: hasSia ? bundle.airac : 'OURAIRPORTS',
        effective_from: hasSia
          ? new Date(bundle.effectiveFrom)
          : new Date(bundle.builtAt),
        effective_to: hasSia
          ? new Date(bundle.effectiveTo)
          : new Date(new Date(bundle.builtAt).getTime() + 365 * 86_400_000),
        source: bundle.source,
        status: accepted ? 'STAGED' : 'REJECTED',
        has_sia: hasSia,
        sha256: digest,
        report: report as unknown as Record<string, unknown>,
      });
      if (!accepted)
        return { cycleId: cycle.id, status: 'REJECTED' as const, report };

      for (let i = 0; i < bundle.points.length; i += CHUNK) {
        await manager.getRepository(NavPointEntity).insert(
          bundle.points.slice(i, i + CHUNK).map((p) => ({
            cycle_id: cycle.id,
            type: p.type,
            ident: p.ident.slice(0, 32),
            name: p.name,
            lat: p.lat,
            lon: p.lon,
            elevation_ft:
              p.elevationFt === null ? null : Math.round(p.elevationFt),
            frequency: p.frequency,
            country: p.country,
            aerodrome_icao: p.aerodromeIcao,
            vrp_mandatory: p.mandatory,
            source: p.source,
            source_id: p.sourceId?.slice(0, 64) ?? null,
            extra: p.extra as Record<string, any> as any,
          })),
        );
      }
      for (let i = 0; i < bundle.airspaces.length; i += CHUNK) {
        await manager.getRepository(AirspaceEntity).insert(
          bundle.airspaces.slice(i, i + CHUNK).map((a) => ({
            cycle_id: cycle.id,
            source_id: a.sourceId.slice(0, 96),
            name: a.name,
            type: a.type,
            icao_class:
              a.icaoClass && a.icaoClass.length === 1 ? a.icaoClass : null,
            floor_ref: a.floor.ref,
            floor_value: a.floor.value,
            ceiling_ref: a.ceiling.ref,
            ceiling_value: a.ceiling.value,
            geometry: a.geometry,
            ...bboxOf(a.geometry, a.referencePoint),
            activity: a.activity,
            schedule_code: a.scheduleCode?.slice(0, 16) ?? null,
            frequencies: a.frequencies,
            remarks: a.remarks,
          })),
        );
      }
      return { cycleId: cycle.id, status: 'STAGED' as const, report };
    });
    if (outcome.status === 'STAGED') {
      const activated = await this.activateDue(
        now,
        options.activateNow ? outcome.cycleId : null,
      );
      if (activated === outcome.cycleId)
        return { ...outcome, status: 'ACTIVE' };
    }
    return outcome;
  }

  // Makes the latest due cycle ACTIVE (SIA cycles on their effective date;
  // `force` activates one cycle now). The previous active cycle is RETIRED;
  // the data of older retired cycles is deleted.
  async activateDue(
    now = new Date(),
    force: number | null = null,
  ): Promise<number | null> {
    const repository = this.dataSource.getRepository(NavdataCycle);
    const staged = await repository.find({
      where: { status: 'STAGED' },
      order: { effective_from: 'DESC', id: 'DESC' },
    });
    const due =
      staged.find((c) => c.id === force) ??
      staged.find((c) => c.effective_from.getTime() <= now.getTime());
    if (!due) return null;
    await this.dataSource.transaction(async (manager) => {
      const active = await manager
        .getRepository(NavdataCycle)
        .find({ where: { status: 'ACTIVE' } });
      // An aerodromes-only cycle never replaces SIA data in force.
      if (!due.has_sia && active.some((c) => c.has_sia) && due.id !== force)
        return;
      await manager.query(
        `DELETE FROM "navdata_cycles" WHERE "status" = 'RETIRED'`,
      );
      await manager.update(
        NavdataCycle,
        { status: 'ACTIVE' },
        { status: 'RETIRED' },
      );
      await manager.update(NavdataCycle, { id: due.id }, { status: 'ACTIVE' });
      // Staged cycles older than the one activated will never be used.
      for (const old of staged.filter(
        (c) => c.id !== due.id && c.effective_from <= due.effective_from,
      )) {
        await manager.update(
          NavdataCycle,
          { id: old.id },
          { status: 'RETIRED' },
        );
      }
    });
    this.navdata.invalidate();
    this.logger.log(
      `Navigation data cycle ${due.airac} (${due.id}) is now active`,
    );
    return due.id;
  }

  // Bundles waiting in NAVDATA_DIR ("navdata-<airac>.json.gz" with an
  // optional ".sha256" next to it) or under NAVDATA_BUNDLE_URL (the files of
  // the current and next cycles).
  async importAvailable(now = new Date()): Promise<ImportOutcome[]> {
    const outcomes: ImportOutcome[] = [];
    const dir = process.env.NAVDATA_DIR;
    if (dir && existsSync(dir)) {
      for (const file of readdirSync(dir)
        .filter((f) => /^navdata-.+\.json\.gz$/.test(f))
        .sort()) {
        const checksumFile = join(dir, `${file}.sha256`);
        const expected = existsSync(checksumFile)
          ? readFileSync(checksumFile, 'utf8').split(/\s/)[0]
          : null;
        outcomes.push(
          await this.importBuffer(readFileSync(join(dir, file)), expected, {
            now,
          }),
        );
      }
    }
    const url = process.env.NAVDATA_BUNDLE_URL;
    if (url) {
      for (const cycle of [airacCycleAt(now), nextAiracCycle(now)]) {
        const base = `${url.replace(/\/$/, '')}/navdata-${cycle.ident}.json.gz`;
        try {
          const [bundle, checksum] = await Promise.all([
            axios.get<ArrayBuffer>(base, {
              responseType: 'arraybuffer',
              timeout: 60_000,
            }),
            axios.get<string>(`${base}.sha256`, {
              responseType: 'text',
              timeout: 10_000,
            }),
          ]);
          outcomes.push(
            await this.importBuffer(
              Buffer.from(bundle.data),
              String(checksum.data).split(/\s/)[0],
              { now },
            ),
          );
        } catch (error) {
          this.logger.warn(
            `No bundle at ${base}: ${(error as Error)?.message}`,
          );
        }
      }
    }
    return outcomes;
  }

  @Cron('0 3 * * *', { timeZone: CLUB_TIME_ZONE })
  async scheduled(): Promise<void> {
    try {
      for (const outcome of await this.importAvailable()) {
        if (outcome.status !== 'SKIPPED') {
          this.logger.log(
            `Navigation data bundle: ${outcome.status} ${JSON.stringify(outcome.report.errors)}`,
          );
        }
      }
      await this.activateDue();
    } catch (error) {
      this.logger.error(
        `Scheduled navigation data import failed: ${(error as Error)?.message}`,
      );
    }
  }

  // At 00:05 UTC: a staged cycle becomes active on its effective date.
  @Cron('5 0 * * *', { timeZone: 'UTC' })
  async activateAtMidnight(): Promise<void> {
    try {
      await this.activateDue();
    } catch (error) {
      this.logger.error(
        `Navigation data activation failed: ${(error as Error)?.message}`,
      );
    }
  }
}
