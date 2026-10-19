import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Repository } from 'typeorm';
import {
  AirspaceRecord,
  altitudeLimitLabel,
  AltitudeLimit,
  AirspaceType,
  hasOutline,
} from '../navplan/engine/airspace-intersection';
import { siaInLanguage, siaText } from './import/sia-text';
import { SIA_HOME, vacUrl } from './import/vac';
import { AerodromeSheet } from '../navplan/engine/aerodrome';
import { ObstacleRecord } from '../navplan/engine/obstacles';
import { ACTIVITY_NEAR_NM } from '../navplan/engine/airspace-intersection';
import { referencePointOf } from '../navplan/engine/airspace-intersection';
import { Language } from '../../common/i18n/languages';
import {
  EnginePoint,
  NavdataStatus,
  NavPointType,
} from '../navplan/engine/engine';
import { inverse } from '../navplan/engine/geodesy';
import { cyclesBehind } from './import/airac';
import {
  AirspaceEntity,
  NavdataCycle,
  NavPointEntity,
  ObstacleEntity,
} from './entity/navdata.entity';
import { localized } from '../../common/i18n/localized-exception';

export const MAX_POINTS_IN_BOX = 2000;
const SEARCH_MAX = 50;
const CACHE_MS = 5 * 60_000;

export interface NavdataInfoView {
  airac: string;
  effectiveFrom: Date;
  effectiveTo: Date;
  stale: boolean;
  source: string;
}

export interface AerodromeView {
  point: EnginePoint;
  sheet: AerodromeSheet;
  runways: AerodromeSheet['runways'];
  frequencies: AerodromeSheet['frequencies'];
  circuitHeightFt: number | null;
}

// The AD 2 data of an aerodrome row, raw (see renderSheet). The VAC link
// needs the cycle in force: its folder in the eAIP is named after the
// effective date; null for a cycle without SIA data, a place that is not
// an aerodrome, or a VAC the build found missing (--check-vac).
export const aerodromeSheetOf = (
  row: NavPointEntity,
  cycle: Pick<NavdataCycle, 'has_sia' | 'effective_from'> | null,
): AerodromeSheet => {
  const info = row.extra?.info ?? {};
  const status: string | null = info.status ?? row.extra?.status ?? null;
  const hasVac =
    row.source === 'SIA' &&
    !!cycle?.has_sia &&
    status !== 'OFF' &&
    info.vac !== false;
  return {
    icao: row.ident,
    name: row.name,
    elevationFt: row.elevation_ft,
    source: row.source,
    status,
    vfr: info.vfr ?? null,
    ifr: info.ifr ?? null,
    privateFlights: info.privateFlights ?? null,
    magneticVariationDeg: info.magneticVariationDeg ?? null,
    magneticVariationYear: info.magneticVariationYear ?? null,
    atsHoursCode: info.atsHoursCode ?? null,
    atsHours: info.atsHours ?? null,
    fuelHours: info.fuelHours ?? null,
    fuel: info.fuel ?? null,
    fuelRemarks: info.fuelRemarks ?? null,
    fuelTypes: info.fuelTypes ?? [],
    remarks: info.remarks ?? null,
    phone: info.phone ?? null,
    operator: info.operator ?? null,
    runways: row.extra?.runways ?? [],
    frequencies: row.extra?.frequencies ?? [],
    vacUrl:
      hasVac && cycle
        ? vacUrl(row.ident, new Date(cycle.effective_from))
        : null,
    chartsUrl: SIA_HOME,
  };
};

// The sheet as shown: SIA texts in the language of the reader.
export const renderSheet = (sheet: AerodromeSheet, language: Language) => {
  const lang = language === 'en' ? 'en' : 'fr';
  return {
    ...sheet,
    atsHours: siaInLanguage(sheet.atsHours, lang),
    fuelHours: siaInLanguage(sheet.fuelHours, lang),
    fuel: siaInLanguage(sheet.fuel, lang),
    fuelRemarks: siaInLanguage(sheet.fuelRemarks, lang),
    remarks: siaInLanguage(sheet.remarks, lang),
    runways: sheet.runways.map((runway) => ({
      ...runway,
      main: runway.main ?? null,
      ends: (runway.ends ?? []).map((end) => ({
        ...end,
        remarks: siaInLanguage(end.remarks, lang),
      })),
    })),
    frequencies: sheet.frequencies.map((f) => ({
      ...f,
      hoursCode: f.hoursCode ?? null,
      hours: f.hours ?? null,
      remark: f.remark ?? null,
      auxiliary: f.auxiliary ?? false,
    })),
  };
};

export const toObstacleRecord = (row: ObstacleEntity): ObstacleRecord => ({
  ident: row.ident,
  type: row.type,
  lat: Number(row.lat),
  lon: Number(row.lon),
  amslFt: row.amsl_ft,
  aglFt: row.agl_ft,
  count: row.count,
  lighting: row.lighting,
});

export const toEnginePoint = (row: NavPointEntity): EnginePoint => ({
  id: row.id,
  type: row.type as NavPointType,
  ident: row.ident,
  name: row.name,
  lat: Number(row.lat),
  lon: Number(row.lon),
  elevationFt: row.elevation_ft,
  frequency: row.frequency,
  aerodromeIcao: row.aerodrome_icao,
  mandatory: row.vrp_mandatory,
});

export const toAirspaceRecord = (row: AirspaceEntity): AirspaceRecord => ({
  id: row.id,
  name: row.name,
  type: row.type as AirspaceType,
  icaoClass: row.icao_class,
  floor: { ref: row.floor_ref as AltitudeLimit['ref'], value: row.floor_value },
  ceiling: {
    ref: row.ceiling_ref as AltitudeLimit['ref'],
    value: row.ceiling_value,
  },
  // Cleaned when read: cycles imported before the cleaning keep the "#" and
  // "\\" of the SIA export.
  activity: siaText(row.activity),
  hours: siaText(row.hours),
  scheduleCode: row.schedule_code,
  frequencies: row.frequencies ?? [],
  remarks: siaText(row.remarks),
  geometry: row.geometry,
  minLat: Number(row.min_lat),
  maxLat: Number(row.max_lat),
  minLon: Number(row.min_lon),
  maxLon: Number(row.max_lon),
});

export const airspaceView = (record: AirspaceRecord) => ({
  ...record,
  hours: record.hours ?? null,
  floor: { ...record.floor, label: altitudeLimitLabel(record.floor) },
  ceiling: { ...record.ceiling, label: altitudeLimitLabel(record.ceiling) },
  geometry: { type: 'MultiPolygon', coordinates: record.geometry },
  // false: the outline is not published (empty geometry), never "no area".
  outlineKnown: hasOutline(record),
  // An area without an outline: its published point (activities, most
  // protected areas); with the distance the plans look around it.
  referencePoint: referencePointOf(record),
  radiusNm: ACTIVITY_NEAR_NM[record.type] ?? null,
  frequencies: record.frequencies.map((f) => ({
    ...f,
    hoursCode: f.hoursCode ?? null,
    hours: f.hours ?? null,
    remark: f.remark ?? null,
    auxiliary: f.auxiliary ?? false,
  })),
});

// Obstacles listed on the map only from this zoom (about 1 degree wide).
export const MAX_OBSTACLES_IN_BOX = 3000;

// A floor in feet for filtering the map (FL taken on 1013.25, AGL as AMSL).
const floorFeet = (limit: AltitudeLimit) =>
  limit.ref === 'SFC'
    ? 0
    : limit.ref === 'FL'
      ? limit.value * 100
      : limit.value;

const isOff = (row: NavPointEntity) =>
  row.type === 'AERODROME' && row.extra?.status === 'OFF';

@Injectable()
export class NavdataService {
  private cycleCache: { at: number; cycle: NavdataCycle | null } | null = null;
  private airspaceCache: { cycleId: number; records: AirspaceRecord[] } | null =
    null;

  constructor(
    @InjectRepository(NavdataCycle)
    private readonly cycles: Repository<NavdataCycle>,
    @InjectRepository(NavPointEntity)
    private readonly points: Repository<NavPointEntity>,
    @InjectRepository(AirspaceEntity)
    private readonly airspaces: Repository<AirspaceEntity>,
    @InjectRepository(ObstacleEntity)
    private readonly obstacles: Repository<ObstacleEntity>,
  ) {}

  invalidate(): void {
    this.cycleCache = null;
    this.airspaceCache = null;
  }

  async activeCycle(): Promise<NavdataCycle | null> {
    if (this.cycleCache && Date.now() - this.cycleCache.at < CACHE_MS) {
      return this.cycleCache.cycle;
    }
    const cycle = await this.cycles.findOne({
      where: { status: 'ACTIVE' },
      order: { effective_from: 'DESC', id: 'DESC' },
    });
    this.cycleCache = { at: Date.now(), cycle: cycle ?? null };
    return cycle ?? null;
  }

  // Data age: SIA cycles are stale once the next cycle is in force; the
  // aerodromes-only data has no cycle and says so in its source.
  status(cycle: NavdataCycle | null, now = new Date()): NavdataStatus {
    if (!cycle) {
      return {
        airac: 'NONE',
        effectiveFrom: new Date(0),
        effectiveTo: new Date(0),
        stale: true,
        cyclesBehind: 99,
        source:
          'Aucune donnée aéronautique importée / no aeronautical data imported',
        hasAirspaces: false,
      };
    }
    const behind = cycle.has_sia ? cyclesBehind(cycle.effective_from, now) : 0;
    return {
      airac: cycle.airac,
      effectiveFrom: cycle.effective_from,
      effectiveTo: cycle.effective_to,
      stale: cycle.has_sia
        ? now.getTime() >= cycle.effective_to.getTime()
        : false,
      cyclesBehind: behind,
      source: cycle.source,
      hasAirspaces: cycle.has_sia,
    };
  }

  async info(now = new Date()): Promise<NavdataInfoView> {
    const { airac, effectiveFrom, effectiveTo, stale, source } = this.status(
      await this.activeCycle(),
      now,
    );
    return { airac, effectiveFrom, effectiveTo, stale, source };
  }

  private async cycleIds(): Promise<number[]> {
    const cycle = await this.activeCycle();
    return cycle ? [cycle.id] : [];
  }

  // Points of the active cycle and the club's own points.
  private scoped() {
    return this.points.createQueryBuilder('p');
  }

  private async whereActive(query: ReturnType<NavdataService['scoped']>) {
    const ids = await this.cycleIds();
    query.where(
      new Brackets((w) => {
        w.where('p.cycle_id IS NULL');
        if (ids.length) w.orWhere('p.cycle_id IN (:...ids)', { ids });
      }),
    );
    // Not aerodromes (AdStatut OFF: CROSS, ACC, DGAC offices, without a
    // runway): never offered, never in a route.
    query.andWhere(`(p.extra->>'status') IS DISTINCT FROM 'OFF'`);
    return query;
  }

  async search(
    text: string,
    types: NavPointType[] | null | undefined,
    near: { lat: number; lon: number } | null | undefined,
    limit = 20,
  ): Promise<EnginePoint[]> {
    const term = text.trim();
    if (term.length < 2) return [];
    const query = await this.whereActive(this.scoped());
    const upper = term.toUpperCase();
    query.andWhere(
      new Brackets((w) => {
        w.where('UPPER(p.ident) LIKE :prefix', {
          prefix: `${upper.replace(/[%_]/g, '')}%`,
        })
          .orWhere('p.name ILIKE :contains', {
            contains: `%${term.replace(/[%_]/g, '')}%`,
          })
          .orWhere('p.aerodrome_icao = :icao', { icao: upper });
      }),
    );
    if (types?.length) query.andWhere('p.type IN (:...types)', { types });
    query
      .orderBy('CASE WHEN UPPER(p.ident) = :exact THEN 0 ELSE 1 END', 'ASC')
      .setParameter('exact', upper)
      .addOrderBy('p.ident', 'ASC')
      .take(200);
    let rows = (await query.getMany()).map(toEnginePoint);
    if (near) {
      const exact = rows.filter((r) => r.ident.toUpperCase() === upper);
      const others = rows
        .filter((r) => r.ident.toUpperCase() !== upper)
        .sort(
          (a, b) => inverse(near, a).distanceM - inverse(near, b).distanceM,
        );
      rows = [...exact, ...others];
    }
    return rows.slice(0, Math.min(Math.max(1, limit), SEARCH_MAX));
  }

  async inBox(
    box: { south: number; west: number; north: number; east: number },
    types: NavPointType[] | null | undefined,
  ): Promise<EnginePoint[]> {
    const query = await this.whereActive(this.scoped());
    query
      .andWhere('p.lat BETWEEN :south AND :north', box)
      .andWhere('p.lon BETWEEN :west AND :east', box);
    if (types?.length) query.andWhere('p.type IN (:...types)', { types });
    const count = await query.getCount();
    if (count > MAX_POINTS_IN_BOX) {
      throw localized(BadRequestException, 'error.navdata.zoomIn', {
        max: MAX_POINTS_IN_BOX,
      });
    }
    return (await query.getMany()).map(toEnginePoint);
  }

  async pointById(id: string): Promise<EnginePoint | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const ids = await this.cycleIds();
    const row = await this.points.findOne({
      where: [
        { id, cycle_id: IsNull() },
        ...(ids.length ? [{ id, cycle_id: In(ids) }] : []),
      ],
    });
    return row && !isOff(row) ? toEnginePoint(row) : null;
  }

  async aerodromeRow(icao: string): Promise<NavPointEntity | null> {
    const ids = await this.cycleIds();
    const ident = icao.trim().toUpperCase();
    return this.points.findOne({
      where: [
        { ident, type: 'AERODROME', cycle_id: IsNull() },
        ...(ids.length
          ? [{ ident, type: 'AERODROME', cycle_id: In(ids) }]
          : []),
      ],
    });
  }

  async aerodrome(icao: string): Promise<AerodromeView | null> {
    const row = await this.aerodromeRow(icao);
    if (!row) return null;
    const sheet = aerodromeSheetOf(row, await this.activeCycle());
    return {
      point: toEnginePoint(row),
      sheet,
      runways: sheet.runways,
      frequencies: sheet.frequencies,
      circuitHeightFt: row.extra?.circuitHeightFt ?? null,
    };
  }

  async aerodromePoint(icao: string): Promise<EnginePoint> {
    const row = await this.aerodromeRow(icao);
    if (!row || isOff(row))
      throw localized(NotFoundException, 'error.navdata.aerodromeNotFound', {
        icao,
      });
    return toEnginePoint(row);
  }

  // All airspaces of the active cycle, kept in memory (about 2000 for
  // France).
  async allAirspaces(): Promise<AirspaceRecord[]> {
    const cycle = await this.activeCycle();
    if (!cycle) return [];
    if (this.airspaceCache?.cycleId === cycle.id)
      return this.airspaceCache.records;
    const rows = await this.airspaces.find({ where: { cycle_id: cycle.id } });
    const records = rows.map(toAirspaceRecord);
    this.airspaceCache = { cycleId: cycle.id, records };
    return records;
  }

  // Obstacles in a box, for the map (refused when the box holds too many:
  // zoom in) and for a plan (all of them around its route).
  async obstaclesInBox(
    box: { south: number; west: number; north: number; east: number },
    max: number | null = MAX_OBSTACLES_IN_BOX,
  ): Promise<ObstacleRecord[]> {
    const cycle = await this.activeCycle();
    if (!cycle) return [];
    const query = this.obstacles
      .createQueryBuilder('o')
      .where('o.cycle_id = :cycle', { cycle: cycle.id })
      .andWhere('o.lat BETWEEN :south AND :north', box)
      .andWhere('o.lon BETWEEN :west AND :east', box);
    if (max !== null && (await query.getCount()) > max) {
      throw localized(BadRequestException, 'error.navdata.zoomIn', { max });
    }
    return (await query.getMany()).map(toObstacleRecord);
  }

  async airspacesInBox(
    box: { south: number; west: number; north: number; east: number },
    maxFloorFt = 19500,
  ): Promise<AirspaceRecord[]> {
    return (await this.allAirspaces()).filter(
      (a) =>
        a.maxLat >= box.south &&
        a.minLat <= box.north &&
        a.maxLon >= box.west &&
        a.minLon <= box.east &&
        floorFeet(a.floor) <= maxFloorFt,
    );
  }
}
