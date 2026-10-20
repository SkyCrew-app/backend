import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { localized } from '../../../common/i18n/localized-exception';
import { TranslationKey } from '../../../common/i18n/fr';
import { translatedList } from '../../../common/i18n/translate';
import { SessionUser } from '../../../common/auth/access';
import { Aircraft } from '../entity/aircraft.entity';
import {
  AircraftMassBalanceEntity,
  AircraftPerformanceEntity,
} from '../entity/aircraft-flight-data.entity';
import {
  DEFAULT_FUEL_DENSITY_KG_PER_L,
  FuelType,
  MassBalanceData,
  PerformanceData,
} from '../../navplan/engine/types';
import { isSimplePolygon } from '../../navplan/engine/polygon';
import type { RunwayDistanceTable } from '../../navplan/engine/runway-distances';
import { AIRCRAFT_TEMPLATES, templateByCode } from './aircraft-templates';
import { User } from '../../users/entity/users.entity';
import type {
  AircraftMassBalanceInput,
  AircraftPerformanceInput,
} from '../../navplan/graphql/contract.inputs';

export interface AircraftFlightData {
  aircraft: Aircraft;
  performance: PerformanceData | null;
  performanceValidated: boolean;
  massBalance: MassBalanceData | null;
  massBalanceValidated: boolean;
}

const displayName = (user?: User | null) =>
  user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email
    : null;

const fuelTypeOf = (text: string | null | undefined): FuelType => {
  const value = (text ?? '').toUpperCase();
  if (/JET|A-?1|DIESEL|TDI/.test(value)) return 'JET_A1';
  if (/UL ?91/.test(value)) return 'UL91';
  if (/MOGAS|SP ?98|SP ?95/.test(value)) return 'MOGAS';
  return 'AVGAS_100LL';
};

// The stored data is usable for a plan when it has at least a cruise table.
export const performanceUsable = (
  row: AircraftPerformanceEntity | null,
): boolean =>
  !!row &&
  Array.isArray(row.cruise?.rows) &&
  row.cruise.rows.length > 0 &&
  !!row.cruise.normalSetting;

// A distance table as stored: null when it has no row.
const distanceTable = (
  input: AircraftPerformanceInput['takeoff'],
): RunwayDistanceTable | null =>
  input && input.rows.length > 0
    ? {
        rows: input.rows.map((row) => ({
          pressureAltFt: row.pressureAltFt,
          temperatureC: row.temperatureC,
          massKg: row.massKg ?? null,
          groundRollM: row.groundRollM,
          distance15mM: row.distance15mM,
        })),
        referenceMassKg: input.referenceMassKg ?? null,
        speedKt: input.speedKt ?? null,
        headwindPercentPerKt: input.headwindPercentPerKt ?? null,
        tailwindPercentPerKt: input.tailwindPercentPerKt ?? null,
        grassPercent: input.grassPercent ?? null,
        wetGrassPercent: input.wetGrassPercent ?? null,
        slopePercentPerPercent: input.slopePercentPerPercent ?? null,
        source: input.source ?? null,
      }
    : null;

export const toPerformanceData = (
  row: AircraftPerformanceEntity,
): PerformanceData => ({
  fuel: row.fuel,
  climb: row.climb,
  cruise: row.cruise,
  descent: row.descent,
  reserve: row.reserve,
  arrivalFuelL: Number(row.arrival_fuel_l) || 0,
  serviceCeilingFt: row.service_ceiling_ft,
  calibration: row.calibration ?? [],
  takeoff: row.takeoff ?? null,
  landing: row.landing ?? null,
});

export const toMassBalanceData = (
  row: AircraftMassBalanceEntity,
): MassBalanceData => ({
  emptyMassKg: row.empty_mass_kg,
  emptyArmM: row.empty_arm_m,
  weighingDate: row.weighing_date,
  weighingRef: row.weighing_ref,
  mtowKg: row.mtow_kg,
  mlwKg: row.mlw_kg,
  mzfwKg: row.mzfw_kg,
  stations: row.stations ?? [],
  combinedLimits: row.combined_limits ?? [],
  envelopes: row.envelopes ?? [],
});

const positive = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

// What is still missing before an administrator may confirm the data: every
// figure the engine uses, so that a template left incomplete (rather than
// filled with plausible guesses) cannot be confirmed as it is.
export function aircraftDataGaps(
  performance: AircraftPerformanceEntity | null,
  massBalance: AircraftMassBalanceEntity | null,
): TranslationKey[] {
  const missing: TranslationKey[] = [];
  if (!performanceUsable(performance))
    missing.push('aircraftData.missing.performance');
  if (performance) {
    const tanks = performance.fuel?.tanks ?? [];
    if (tanks.length === 0 || tanks.some((t) => !positive(t.usableL)))
      missing.push('aircraftData.missing.tanks');
    const climb =
      performance.climb ?? ({} as AircraftPerformanceEntity['climb']);
    const climbTable = (climb.table ?? []).length >= 2;
    if (
      !positive(climb.iasKt) ||
      (!climbTable &&
        !(
          positive(climb.seaLevelRateFpm) &&
          positive(climb.fuelFlowLph) &&
          positive(performance.service_ceiling_ft)
        ))
    )
      missing.push('aircraftData.missing.climb');
    const descent = performance.descent;
    if (
      !positive(descent?.iasKt) ||
      !positive(descent?.rateFpm) ||
      !positive(descent?.fuelFlowLph)
    )
      missing.push('aircraftData.missing.descent');
    if (
      !positive(performance.reserve?.holdingFuelFlowLph) ||
      !positive(performance.reserve?.maxContinuousFuelFlowLph)
    )
      missing.push('aircraftData.missing.reserve');
  }
  if (!massBalance) missing.push('aircraftData.missing.massBalance');
  else {
    if (massBalance.empty_mass_kg == null || massBalance.empty_arm_m == null)
      missing.push('aircraftData.missing.weighing');
    if (!massBalance.weighing_date)
      missing.push('aircraftData.missing.weighingDate');
    if (massBalance.mtow_kg == null) missing.push('aircraftData.missing.mtow');
    if (massBalance.mlw_kg == null) missing.push('aircraftData.missing.mlw');
    const stations = massBalance.stations ?? [];
    if (!stations.some((st) => st.kind === 'SEAT'))
      missing.push('aircraftData.missing.seats');
    if (!(massBalance.envelopes ?? []).some((e) => e.points?.length >= 3))
      missing.push('aircraftData.missing.envelope');
    if ((performance?.fuel?.tanks ?? []).some((t) => !Number.isFinite(t.armM)))
      missing.push('aircraftData.missing.fuelArm');
  }
  return missing;
}

// Performance derived from the fleet sheet (cruise speed in kt, consumption
// in L/h), for an aircraft without manual data: enough to draw a plan,
// always flagged as such.
export function fleetPerformance(aircraft: Aircraft): PerformanceData {
  const tas = Number(aircraft.cruiseSpeed) || 100;
  const flow = Number(aircraft.consumption) || 30;
  const capacity = Number(aircraft.fuel_capacity) || 100;
  const fuelType = fuelTypeOf(aircraft.fuel_type);
  return {
    fuel: {
      type: fuelType,
      densityKgPerL: DEFAULT_FUEL_DENSITY_KG_PER_L[fuelType],
      tanks: [
        {
          id: 'main',
          label: 'Réservoir / Tank',
          usableL: capacity,
          unusableL: 0,
          armM: 0,
        },
      ],
      taxiFuelL: 3,
      burnOrder: [],
    },
    climb: {
      iasKt: Math.round(tas * 0.65),
      table: null,
      seaLevelRateFpm: 600,
      ceilingRateFpm: 100,
      fuelFlowLph: flow * 1.2,
    },
    cruise: {
      normalSetting: 'fleet',
      rows: [0, 4000, 8000, 12000].map((pressureAltFt) => ({
        pressureAltFt,
        setting: 'fleet',
        isaDeviationC: 0,
        tasKt: tas,
        fuelFlowLph: flow,
      })),
    },
    descent: {
      iasKt: Math.round(tas * 0.85),
      rateFpm: 500,
      fuelFlowLph: flow * 0.6,
    },
    reserve: {
      holdingFuelFlowLph: flow * 0.8,
      maxContinuousFuelFlowLph: flow * 1.15,
    },
    arrivalFuelL: 0,
    serviceCeilingFt: Math.max(Number(aircraft.maxAltitude) || 12000, 12500),
    calibration: [],
  };
}

@Injectable()
export class AircraftDataService {
  constructor(
    @InjectRepository(Aircraft) private readonly aircraft: Repository<Aircraft>,
    @InjectRepository(AircraftPerformanceEntity)
    private readonly performance: Repository<AircraftPerformanceEntity>,
    @InjectRepository(AircraftMassBalanceEntity)
    private readonly massBalance: Repository<AircraftMassBalanceEntity>,
  ) {}

  templates() {
    return AIRCRAFT_TEMPLATES.map(({ code, label, source }) => ({
      code,
      label,
      source,
    }));
  }

  private async aircraftOrFail(id: number): Promise<Aircraft> {
    const aircraft = await this.aircraft.findOne({ where: { id } });
    if (!aircraft)
      throw localized(NotFoundException, 'error.aircraftData.aircraftNotFound');
    return aircraft;
  }

  async performanceRow(aircraftId: number) {
    return this.performance.findOne({
      where: { aircraft_id: aircraftId },
      relations: ['validated_by'],
    });
  }

  async massBalanceRow(aircraftId: number) {
    return this.massBalance.findOne({
      where: { aircraft_id: aircraftId },
      relations: ['validated_by'],
    });
  }

  performanceView(row: AircraftPerformanceEntity | null) {
    if (!row) return null;
    return {
      aircraftId: row.aircraft_id,
      templateCode: row.template_code,
      ...toPerformanceData(row),
      climb: {
        table: null,
        seaLevelRateFpm: null,
        ceilingRateFpm: null,
        fuelFlowLph: null,
        ...row.climb,
      },
      source: row.source,
      validatedAt: row.validated_at,
      validatedBy: displayName(row.validated_by),
    };
  }

  massBalanceView(row: AircraftMassBalanceEntity | null) {
    if (!row) return null;
    return {
      aircraftId: row.aircraft_id,
      ...toMassBalanceData(row),
      weighingDate: row.weighing_date,
      stations: (row.stations ?? []).map((s) => ({
        maxKg: null,
        tankId: null,
        ...s,
      })),
      validatedAt: row.validated_at,
      validatedBy: displayName(row.validated_by),
    };
  }

  async getPerformance(aircraftId: number) {
    return this.performanceView(await this.performanceRow(aircraftId));
  }

  async getMassBalance(aircraftId: number) {
    return this.massBalanceView(await this.massBalanceRow(aircraftId));
  }

  async flightData(aircraftId: number): Promise<AircraftFlightData> {
    const aircraft = await this.aircraftOrFail(aircraftId);
    const [performance, massBalance] = await Promise.all([
      this.performanceRow(aircraftId),
      this.massBalanceRow(aircraftId),
    ]);
    return {
      aircraft,
      performance: performanceUsable(performance)
        ? toPerformanceData(performance)
        : null,
      performanceValidated:
        performanceUsable(performance) && !!performance.validated_at,
      massBalance: massBalance ? toMassBalanceData(massBalance) : null,
      massBalanceValidated: !!massBalance?.validated_at,
    };
  }

  // A template fills the performance and the loading stations, envelopes
  // and maximum masses; the weighing (empty mass and arm) stays the
  // aircraft's own. The result has to be confirmed again.
  async applyTemplate(aircraftId: number, code: string) {
    await this.aircraftOrFail(aircraftId);
    // The distance tables entered for the aircraft stay: no template has
    // any (none was read in a manual).
    const own = await this.performanceRow(aircraftId);
    const template = templateByCode(code);
    if (!template)
      throw localized(
        BadRequestException,
        'error.aircraftData.unknownTemplate',
        { code },
      );
    await this.performance.save({
      aircraft_id: aircraftId,
      template_code: template.code,
      fuel: template.performance.fuel,
      climb: template.performance.climb,
      cruise: template.performance.cruise,
      descent: template.performance.descent,
      reserve: template.performance.reserve,
      arrival_fuel_l: template.performance.arrivalFuelL,
      calibration: template.performance.calibration,
      service_ceiling_ft: template.performance.serviceCeilingFt,
      takeoff: template.performance.takeoff ?? own?.takeoff ?? null,
      landing: template.performance.landing ?? own?.landing ?? null,
      source: template.source,
      validated_by_id: null,
      validated_at: null,
    });
    const current = await this.massBalanceRow(aircraftId);
    await this.massBalance.save({
      aircraft_id: aircraftId,
      empty_mass_kg: current?.empty_mass_kg ?? null,
      empty_arm_m: current?.empty_arm_m ?? null,
      weighing_date: current?.weighing_date ?? null,
      weighing_ref: current?.weighing_ref ?? null,
      mtow_kg: template.massBalance.mtowKg,
      mlw_kg: template.massBalance.mlwKg,
      mzfw_kg: template.massBalance.mzfwKg ?? null,
      stations: template.massBalance.stations,
      combined_limits: template.massBalance.combinedLimits,
      envelopes: template.massBalance.envelopes,
      validated_by_id: null,
      validated_at: null,
    });
    return this.getPerformance(aircraftId);
  }

  async savePerformance(aircraftId: number, input: AircraftPerformanceInput) {
    await this.aircraftOrFail(aircraftId);
    this.checkPerformance(input);
    const current = await this.performanceRow(aircraftId);
    await this.performance.save({
      aircraft_id: aircraftId,
      template_code: current?.template_code ?? null,
      fuel: {
        ...input.fuel,
        tanks: input.fuel.tanks.map((t) => ({ ...t })),
        burnOrder: [...input.fuel.burnOrder],
      },
      climb: {
        iasKt: input.climb.iasKt,
        table: input.climb.table?.map((row) => ({ ...row })) ?? null,
        seaLevelRateFpm: input.climb.seaLevelRateFpm ?? null,
        ceilingRateFpm: input.climb.ceilingRateFpm ?? null,
        fuelFlowLph: input.climb.fuelFlowLph ?? null,
      },
      cruise: {
        normalSetting: input.cruise.normalSetting,
        rows: input.cruise.rows.map((row) => ({ ...row })),
      },
      descent: { ...input.descent },
      reserve: { ...input.reserve },
      arrival_fuel_l: input.arrivalFuelL,
      calibration: input.calibration.map((row) => ({ ...row })),
      service_ceiling_ft: input.serviceCeilingFt ?? null,
      // Absent from the input (an older screen): kept as they are.
      takeoff:
        input.takeoff === undefined
          ? (current?.takeoff ?? null)
          : distanceTable(input.takeoff),
      landing:
        input.landing === undefined
          ? (current?.landing ?? null)
          : distanceTable(input.landing),
      source: input.source ?? null,
      validated_by_id: null,
      validated_at: null,
    });
    return this.getPerformance(aircraftId);
  }

  checkPerformance(input: AircraftPerformanceInput): void {
    const refuse = (detail: string) => {
      throw localized(
        BadRequestException,
        'error.aircraftData.invalidPerformance',
        { detail },
      );
    };
    const tankIds = input.fuel.tanks.map((t) => t.id);
    if (tankIds.length === 0) refuse('no tank');
    if (new Set(tankIds).size !== tankIds.length) refuse('duplicate tank id');
    if (input.fuel.burnOrder.some((id) => !tankIds.includes(id)))
      refuse('burnOrder: unknown tank');
    if (
      !input.cruise.rows.some(
        (row) => row.setting === input.cruise.normalSetting,
      )
    ) {
      refuse(
        `no cruise row for the normal setting "${input.cruise.normalSetting}"`,
      );
    }
    const keys = input.cruise.rows.map(
      (row) => `${row.setting}|${row.pressureAltFt}|${row.isaDeviationC}`,
    );
    if (new Set(keys).size !== keys.length) refuse('duplicate cruise row');
    for (const [label, distances] of [
      ['take-off', input.takeoff],
      ['landing', input.landing],
    ] as const) {
      if (!distances) continue;
      const keys = distances.rows.map(
        (row) => `${row.pressureAltFt}|${row.temperatureC}|${row.massKg ?? ''}`,
      );
      if (new Set(keys).size !== keys.length)
        refuse(`${label} table: two rows for the same conditions`);
      const withMass = distances.rows.filter((row) => row.massKg != null);
      if (
        withMass.length > 0 &&
        withMass.length < distances.rows.length &&
        distances.referenceMassKg == null
      )
        refuse(`${label} table: a mass for every row, or a reference mass`);
      if (distances.rows.some((row) => row.distance15mM < row.groundRollM))
        refuse(
          `${label} table: the distance at 15 m is shorter than the ground roll`,
        );
    }
    const table = input.climb.table ?? [];
    if (table.length > 0) {
      if (table.length < 2) refuse('climb table: at least two rows');
      const sorted = [...table].sort(
        (a, b) => a.pressureAltFt - b.pressureAltFt,
      );
      for (let i = 1; i < sorted.length; i++) {
        if (
          sorted[i].pressureAltFt === sorted[i - 1].pressureAltFt ||
          sorted[i].timeMin < sorted[i - 1].timeMin ||
          sorted[i].fuelL < sorted[i - 1].fuelL ||
          sorted[i].distanceNm < sorted[i - 1].distanceNm
        ) {
          refuse(
            'climb table: time, fuel and distance must grow with altitude',
          );
        }
      }
    } else if (
      !input.climb.seaLevelRateFpm ||
      !input.climb.fuelFlowLph ||
      !input.serviceCeilingFt
    ) {
      refuse(
        'climb: a table, or the sea level rate, fuel flow and service ceiling',
      );
    }
  }

  checkMassBalance(
    input: AircraftMassBalanceInput,
    tankIds: string[] | null,
  ): void {
    const refuse = (detail: string) => {
      throw localized(
        BadRequestException,
        'error.aircraftData.invalidMassBalance',
        { detail },
      );
    };
    if (input.mlwKg > input.mtowKg) refuse('MLW above MTOW');
    if (input.emptyMassKg >= input.mtowKg) refuse('empty mass not below MTOW');
    const ids = input.stations.map((s) => s.id);
    if (new Set(ids).size !== ids.length) refuse('duplicate station id');
    for (const limit of input.combinedLimits) {
      if (limit.stationIds.some((id) => !ids.includes(id)))
        refuse(`${limit.label}: unknown station`);
    }
    for (const station of input.stations) {
      if (
        station.kind === 'FUEL' &&
        tankIds &&
        station.tankId &&
        !tankIds.includes(station.tankId)
      ) {
        refuse(`${station.label}: unknown tank ${station.tankId}`);
      }
    }
    if (input.envelopes.length === 0) refuse('no envelope');
    const categories = input.envelopes.map((e) => e.category);
    if (new Set(categories).size !== categories.length)
      refuse('two envelopes of the same category');
    for (const envelope of input.envelopes) {
      const ring = envelope.points.map(
        (p) => [p.armM, p.massKg] as [number, number],
      );
      if (ring.length < 3 || !isSimplePolygon(ring)) {
        refuse(
          `${envelope.category}: the envelope must be a simple polygon of at least 3 points`,
        );
      }
    }
  }

  async saveMassBalance(aircraftId: number, input: AircraftMassBalanceInput) {
    await this.aircraftOrFail(aircraftId);
    const performance = await this.performanceRow(aircraftId);
    this.checkMassBalance(
      input,
      performance?.fuel?.tanks?.map((t) => t.id) ?? null,
    );
    await this.massBalance.save({
      aircraft_id: aircraftId,
      empty_mass_kg: input.emptyMassKg,
      empty_arm_m: input.emptyArmM,
      weighing_date: input.weighingDate,
      weighing_ref: input.weighingRef ?? null,
      mtow_kg: input.mtowKg,
      mlw_kg: input.mlwKg,
      mzfw_kg: input.mzfwKg ?? null,
      stations: input.stations.map((s) => ({
        ...s,
        maxKg: s.maxKg ?? null,
        tankId: s.tankId ?? null,
      })),
      combined_limits: input.combinedLimits.map((c) => ({
        ...c,
        stationIds: [...c.stationIds],
      })),
      envelopes: input.envelopes.map((e) => ({
        category: e.category,
        points: e.points.map((p) => ({ ...p })),
      })),
      validated_by_id: null,
      validated_at: null,
    });
    return this.getMassBalance(aircraftId);
  }

  // An administrator confirms that both records are the aircraft's own.
  // Refused while one of them is incomplete.
  async validate(aircraftId: number, requester: SessionUser): Promise<boolean> {
    await this.aircraftOrFail(aircraftId);
    const [performance, massBalance] = await Promise.all([
      this.performanceRow(aircraftId),
      this.massBalanceRow(aircraftId),
    ]);
    const missing = aircraftDataGaps(performance, massBalance);
    if (missing.length > 0) {
      throw localized(BadRequestException, 'error.aircraftData.incomplete', {
        missing: translatedList(missing),
      });
    }
    const now = new Date();
    await this.performance.update(
      { aircraft_id: aircraftId },
      { validated_by_id: requester.id, validated_at: now },
    );
    await this.massBalance.update(
      { aircraft_id: aircraftId },
      { validated_by_id: requester.id, validated_at: now },
    );
    return true;
  }
}
