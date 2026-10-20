import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { localized } from '../../common/i18n/localized-exception';
import { isAdmin, SessionUser } from '../../common/auth/access';
import { Language } from '../../common/i18n/languages';
import {
  AircraftDataService,
  fleetPerformance,
} from '../aircraft/flight-data/aircraft-data.service';
import { NavdataService } from '../navdata/navdata.service';
import { FlightsService } from '../flights/flights.service';
import { Reservation } from '../reservations/entity/reservations.entity';
import { Flight } from '../flights/entity/flights.entity';
import {
  computeFlightPlan,
  EngineInput,
  EnginePoint,
  EngineSettings,
  FlightPlanResult,
  TAXI_OUT_MINUTES,
} from './engine/engine';
import { DEFAULT_FUEL_SETTINGS, fuelSettingsProblems } from './engine/fuel';
import { inverse, pointAlong } from './engine/geodesy';
import { STANDARD_PRESSURE_HPA } from './engine/atmosphere';
import { hasOutline, isActivityType } from './engine/airspace-intersection';
import { navLogFrequency } from './engine/aerodrome';
import { FlightPlanEntity } from './entity/flight-plan.entity';
import { FlightPlanningSettingsEntity } from './entity/flight-planning-settings.entity';
import {
  FlightPlanInput,
  FlightPlanningSettingsInput,
  RoutePointInput,
} from './graphql/contract.inputs';
import { renderResult } from './render';
import { MetarTafService } from './weather/metar-taf.service';
import { WindsAloftService } from './weather/winds-aloft.service';
import { buildDossierPdf } from './pdf/dossier.pdf';
import {
  DEFAULT_MSA_CORRIDOR_NM,
  DEFAULT_MSA_MARGIN_FT,
  TerrainGrid,
} from './engine/terrain';
import {
  DEFAULT_LANDING_SAFETY_FACTOR,
  DEFAULT_TAKEOFF_SAFETY_FACTOR,
} from './engine/runway-distances';
import { loadTerrainGrid } from './terrain/terrain-file';

export const PLAN_ENGINE = 'navplan-1';
// METARs of the aerodromes within this distance of the route are shown.
const NEARBY_METAR_NM = 25;

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  ...DEFAULT_FUEL_SETTINGS,
  verticalMarginFt: 300,
  defaultCircuitHeightFt: 1000,
  defaultDescentFpm: 500,
  msaCorridorNm: DEFAULT_MSA_CORRIDOR_NM,
  msaMarginFt: DEFAULT_MSA_MARGIN_FT,
  takeoffSafetyFactor: DEFAULT_TAKEOFF_SAFETY_FACTOR,
  landingSafetyFactor: DEFAULT_LANDING_SAFETY_FACTOR,
};

const settingsOf = (
  row: FlightPlanningSettingsEntity | null,
): EngineSettings =>
  row
    ? {
        reserveVfrDayLocalMin: row.reserve_vfr_day_local_min,
        reserveVfrDayMin: row.reserve_vfr_day_min,
        reserveVfrNightMin: row.reserve_vfr_night_min,
        contingencyPercent: Number(row.contingency_percent),
        contingencyMinL: Number(row.contingency_min_l),
        alternateRequiredVfr: row.alternate_required_vfr,
        clubMarginMin: row.club_margin_min,
        verticalMarginFt: row.vertical_margin_ft,
        defaultCircuitHeightFt: row.default_circuit_height_ft,
        defaultDescentFpm: row.default_descent_fpm,
        msaCorridorNm: Number(row.msa_corridor_nm ?? DEFAULT_MSA_CORRIDOR_NM),
        msaMarginFt: row.msa_margin_ft ?? DEFAULT_MSA_MARGIN_FT,
        takeoffSafetyFactor: Number(
          row.takeoff_safety_factor ?? DEFAULT_TAKEOFF_SAFETY_FACTOR,
        ),
        landingSafetyFactor: Number(
          row.landing_safety_factor ?? DEFAULT_LANDING_SAFETY_FACTOR,
        ),
      }
    : DEFAULT_ENGINE_SETTINGS;

const sameId = (a: unknown, b: unknown) =>
  a != null && b != null && Number(a) === Number(b);

// The terrain grid shipped with the code, read once (about 5 MB in memory).
let terrainGrid: TerrainGrid | null | undefined;
const terrain = (logger: Logger): TerrainGrid | null => {
  if (terrainGrid === undefined) {
    try {
      terrainGrid = loadTerrainGrid();
      if (!terrainGrid)
        logger.warn('No terrain grid: every minimum safe altitude is unknown');
    } catch (error) {
      logger.error(`Terrain grid unreadable: ${(error as Error).message}`);
      terrainGrid = null;
    }
  }
  return terrainGrid;
};

@Injectable()
export class NavplanService {
  private readonly logger = new Logger(NavplanService.name);

  constructor(
    private readonly navdata: NavdataService,
    private readonly aircraftData: AircraftDataService,
    private readonly metarTaf: MetarTafService,
    private readonly winds: WindsAloftService,
    private readonly flights: FlightsService,
    @InjectRepository(FlightPlanEntity)
    private readonly plans: Repository<FlightPlanEntity>,
    @InjectRepository(FlightPlanningSettingsEntity)
    private readonly settingsRepository: Repository<FlightPlanningSettingsEntity>,
    @InjectRepository(Reservation)
    private readonly reservations: Repository<Reservation>,
  ) {}

  // ---------- Club settings ----------
  async settings(): Promise<EngineSettings> {
    return settingsOf(
      await this.settingsRepository.findOne({ where: { id: 1 } }),
    );
  }

  async saveSettings(
    input: FlightPlanningSettingsInput,
  ): Promise<EngineSettings> {
    const [problem] = fuelSettingsProblems(input);
    if (problem) {
      throw localized(BadRequestException, 'error.navplan.reserveBelowAmc', {
        label: String(problem.params?.label),
        minimum: Number(problem.params?.minimum),
      });
    }
    const current = await this.settings();
    await this.settingsRepository.save({
      id: 1,
      reserve_vfr_day_local_min: input.reserveVfrDayLocalMin,
      reserve_vfr_day_min: input.reserveVfrDayMin,
      reserve_vfr_night_min: input.reserveVfrNightMin,
      contingency_percent: input.contingencyPercent,
      contingency_min_l: input.contingencyMinL,
      alternate_required_vfr: input.alternateRequiredVfr,
      club_margin_min: input.clubMarginMin,
      vertical_margin_ft: input.verticalMarginFt,
      default_circuit_height_ft: input.defaultCircuitHeightFt,
      default_descent_fpm: current.defaultDescentFpm,
      msa_corridor_nm: input.msaCorridorNm ?? current.msaCorridorNm,
      msa_margin_ft: input.msaMarginFt ?? current.msaMarginFt,
      takeoff_safety_factor:
        input.takeoffSafetyFactor ?? current.takeoffSafetyFactor,
      landing_safety_factor:
        input.landingSafetyFactor ?? current.landingSafetyFactor,
    });
    return this.settings();
  }

  // ---------- Route ----------
  private async resolvePoint(
    point: RoutePointInput,
    aerodrome: boolean,
  ): Promise<EnginePoint> {
    let resolved: EnginePoint | null = null;
    const userMatch = /^USER:(-?[\d.]+),(-?[\d.]+)$/.exec(
      point.navPointId ?? '',
    );
    if (point.navPointId && !userMatch) {
      resolved = await this.navdata.pointById(point.navPointId);
      if (!resolved)
        throw localized(BadRequestException, 'error.navplan.pointNotFound');
    } else {
      const lat = userMatch ? Number(userMatch[1]) : point.lat;
      const lon = userMatch ? Number(userMatch[2]) : point.lon;
      if (
        lat == null ||
        lon == null ||
        Math.abs(lat) > 90 ||
        Math.abs(lon) > 180
      ) {
        throw localized(BadRequestException, 'error.navplan.pointNotFound');
      }
      const name = (point.name ?? '').trim().slice(0, 40) || null;
      resolved = {
        id: `USER:${lat.toFixed(6)},${lon.toFixed(6)}`,
        type: 'USER',
        ident: name ?? `${lat.toFixed(3)} ${lon.toFixed(3)}`,
        name,
        lat,
        lon,
        elevationFt: null,
        frequency: null,
        aerodromeIcao: null,
        mandatory: null,
      };
    }
    if (aerodrome && resolved.type !== 'AERODROME') {
      throw localized(BadRequestException, 'error.navplan.aerodromeRequired');
    }
    return resolved;
  }

  private async nearbyMetars(points: EnginePoint[]) {
    const lats = points.map((p) => p.lat);
    const lons = points.map((p) => p.lon);
    const margin = NEARBY_METAR_NM / 60;
    const box = {
      south: Math.min(...lats) - margin,
      north: Math.max(...lats) + margin,
      west: Math.min(...lons) - margin * 1.5,
      east: Math.max(...lons) + margin * 1.5,
    };
    const metars = await this.metarTaf.metarsInBox(box);
    // Samples every 5 NM along the route.
    const samples: { lat: number; lon: number }[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const distance = inverse(points[i], points[i + 1]).distanceNm;
      for (let d = 0; d <= distance; d += 5)
        samples.push(pointAlong(points[i], points[i + 1], d));
    }
    samples.push(points[points.length - 1]);
    return metars.filter(
      (m) =>
        m.lat != null &&
        m.lon != null &&
        samples.some(
          (s) =>
            inverse(s, { lat: m.lat, lon: m.lon }).distanceNm <=
            NEARBY_METAR_NM,
        ),
    );
  }

  async engineInput(
    input: FlightPlanInput,
    now = new Date(),
  ): Promise<EngineInput> {
    if (input.legs.length !== input.waypoints.length + 1) {
      throw localized(BadRequestException, 'error.navplan.legsCount', {
        expected: input.waypoints.length + 1,
      });
    }
    const [
      departure,
      destination,
      alternate,
      waypoints,
      data,
      settings,
      navdataCycle,
    ] = await Promise.all([
      this.resolvePoint(input.departure, true),
      this.resolvePoint(input.destination, true),
      input.alternate
        ? this.resolvePoint(input.alternate, true)
        : Promise.resolve(null),
      Promise.all(input.waypoints.map((w) => this.resolvePoint(w, false))),
      this.aircraftData.flightData(input.aircraftId),
      this.settings(),
      this.navdata.activeCycle(),
    ]);
    const route = [
      departure,
      ...waypoints,
      destination,
      ...(alternate ? [alternate] : []),
    ];

    let qnh = input.qnhHpa ?? null;
    let qnhSource: EngineInput['qnhSource'] = 'INPUT';
    let qnhObservedAt: Date | null = null;
    if (qnh == null) {
      const metar = await this.metarTaf
        .qnhOf(departure.ident)
        .catch(() => null);
      qnh = metar?.qnhHpa ?? null;
      qnhObservedAt = metar?.observedAt ?? null;
      qnhSource = qnh == null ? 'DEFAULT' : 'METAR';
    }
    const qnhHpa = qnh ?? STANDARD_PRESSURE_HPA;

    const lats = route.map((p) => p.lat);
    const lons = route.map((p) => p.lon);
    const obstacleMargin = Math.max(0.1, (settings.msaCorridorNm + 1) / 60);
    const allAirspaces = await this.navdata.allAirspaces();
    // Areas without an outline are all kept: the engine lists those near
    // the route from their point (UNVERIFIED_AIRSPACE_NEAR_NM).
    const airspaces = allAirspaces.filter(
      (a) =>
        (!hasOutline(a) && !isActivityType(a.type)) ||
        (a.maxLat >= Math.min(...lats) - 0.2 &&
          a.minLat <= Math.max(...lats) + 0.2 &&
          a.maxLon >= Math.min(...lons) - 0.3 &&
          a.minLon <= Math.max(...lons) + 0.3),
    );
    const [
      nearby,
      destinationDetails,
      departureDetails,
      alternateDetails,
      obstacles,
    ] = await Promise.all([
      this.nearbyMetars(route).catch(() => []),
      this.navdata.aerodrome(destination.ident),
      this.navdata.aerodrome(departure.ident),
      alternate ? this.navdata.aerodrome(alternate.ident) : null,
      // Wide enough for the minimum safe altitude corridor.
      this.navdata
        .obstaclesInBox(
          {
            south: Math.min(...lats) - obstacleMargin,
            north: Math.max(...lats) + obstacleMargin,
            west: Math.min(...lons) - obstacleMargin * 1.5,
            east: Math.max(...lons) + obstacleMargin * 1.5,
          },
          null,
        )
        .catch(() => []),
    ]);
    // The nav log frequency of the aerodromes of the route (see
    // navLogFrequency for the rule).
    const withFrequency = (
      point: EnginePoint,
      details: { sheet: Parameters<typeof navLogFrequency>[0] } | null,
      role: Parameters<typeof navLogFrequency>[1],
    ): EnginePoint =>
      details
        ? {
            ...point,
            frequency: navLogFrequency(details.sheet, role) ?? point.frequency,
          }
        : point;
    const enRouteAerodromes = await Promise.all(
      waypoints.map((w) =>
        w.type === 'AERODROME'
          ? this.navdata.aerodrome(w.ident).catch(() => null)
          : null,
      ),
    );
    const weather = await this.metarTaf
      .reports(
        [
          departure.ident,
          destination.ident,
          ...(alternate ? [alternate.ident] : []),
        ],
        nearby,
      )
      .catch(() => []);
    const wind = this.winds.provider(qnhHpa);

    return {
      departureTime: new Date(input.departureTime),
      departure: withFrequency(departure, departureDetails, 'departure'),
      destination: withFrequency(
        destination,
        destinationDetails,
        'destination',
      ),
      alternate: alternate
        ? withFrequency(alternate, alternateDetails, 'alternate')
        : null,
      waypoints: waypoints.map((w, i) =>
        withFrequency(w, enRouteAerodromes[i], 'enroute'),
      ),
      legs: input.legs.map((leg) => ({
        altitudeFt: leg.altitudeFt,
        cruiseSetting: leg.cruiseSetting ?? null,
        windOverride: leg.windOverride
          ? {
              directionDeg: leg.windOverride.directionDeg,
              speedKt: leg.windOverride.speedKt,
              temperatureC: leg.windOverride.temperatureC ?? null,
            }
          : null,
      })),
      reserveCase: input.reserveCase,
      qnhHpa,
      qnhSource,
      qnhStation: qnhSource === 'METAR' ? departure.ident : null,
      qnhObservedAt,
      loads: input.loads.map((l) => ({
        stationId: l.stationId,
        massKg: l.massKg ?? null,
      })),
      fuel: input.fuel.map((f) => ({ tankId: f.tankId, liters: f.liters })),
      envelopeCategory: input.envelopeCategory ?? 'NORMAL',
      performance: data.performance ?? fleetPerformance(data.aircraft),
      performanceStatus: !data.performance
        ? 'FLEET_DATA_ONLY'
        : data.performanceValidated
          ? 'VALIDATED'
          : 'NOT_VALIDATED',
      massBalance: data.massBalance,
      massBalanceValidated: data.massBalanceValidated,
      settings,
      circuitHeightFt: destinationDetails?.circuitHeightFt ?? null,
      airspaces,
      navdata: this.navdata.status(navdataCycle, now),
      wind: wind.provider,
      windSource: wind.source,
      windCoverage: wind.coverage,
      weather,
      aerodromes: {
        departure: departureDetails?.sheet ?? null,
        destination: destinationDetails?.sheet ?? null,
        alternate: alternateDetails?.sheet ?? null,
      },
      obstacles,
      terrain: terrain(this.logger),
    };
  }

  async compute(input: FlightPlanInput): Promise<FlightPlanResult> {
    return computeFlightPlan(await this.engineInput(input));
  }

  async computeRendered(input: FlightPlanInput, language: Language) {
    return renderResult(await this.compute(input), language);
  }

  // ---------- Saved plans ----------
  private planView(plan: FlightPlanEntity, language: Language) {
    return {
      id: plan.id,
      flightId: plan.flight_id,
      input: plan.input,
      result: renderResult(
        plan.result as unknown as FlightPlanResult,
        language,
      ),
      createdAt: plan.created_at,
      updatedAt: plan.updated_at,
    };
  }

  private async assertCanRead(plan: FlightPlanEntity, requester: SessionUser) {
    const reservation = plan.reservation_id
      ? await this.reservations.findOne({
          where: { id: plan.reservation_id },
          relations: ['instructor'],
        })
      : null;
    if (
      !(await this.flights.canReadFlightsOf(
        plan.user_id,
        requester,
        reservation?.instructor?.id ?? null,
      ))
    ) {
      throw localized(ForbiddenException, 'error.navplan.notOwnPlan');
    }
  }

  async findOne(id: number, requester: SessionUser, language: Language) {
    const plan = await this.plans.findOne({ where: { id } });
    if (!plan) return null;
    await this.assertCanRead(plan, requester);
    return this.planView(plan, language);
  }

  async findByFlight(
    flightId: number,
    requester: SessionUser,
    language: Language,
  ) {
    const plan = await this.plans.findOne({ where: { flight_id: flightId } });
    if (!plan) return null;
    await this.assertCanRead(plan, requester);
    return this.planView(plan, language);
  }

  // What the existing screens read from a flight: filled from the new plan
  // so that the plan list, the booking, the logbook and closing a flight
  // keep working. In `waypoints`, the leg ending at a point is stored on
  // that point (distance, GS, drift of the leg flown to reach it).
  private legacyColumns(
    result: FlightPlanResult,
    reservation: Reservation | null,
  ) {
    const minutes = result.totalTimeMin;
    const departure = new Date(result.departureTime);
    const legs = result.legs;
    const waypoints = [
      {
        ident: legs[0].from.ident,
        type: legs[0].from.type,
        name: legs[0].from.name ?? legs[0].from.ident,
        lat: legs[0].from.lat,
        lon: legs[0].from.lon,
        alt: legs[0].from.elevationFt ?? 0,
        phase: 'DEP',
        time_from_dep_min: 0,
        fuel_remaining_liters:
          Math.round((result.fuel.loadedL - result.fuel.taxiL) * 10) / 10,
      },
      ...legs.map((leg) => ({
        ident: leg.to.ident,
        type: leg.to.type,
        name: leg.to.name ?? leg.to.ident,
        lat: leg.to.lat,
        lon: leg.to.lon,
        alt: leg.altitudeFt,
        phase: 'CRUISE',
        speed_kts: Math.round(leg.tasKt),
        ground_speed_kts: Math.round(leg.groundSpeedKt),
        wind_correction_deg: Math.round(leg.windCorrectionDeg),
        heading_deg: Math.round(leg.magneticHeadingDeg),
        leg_distance_nm: Math.round(leg.distanceNm * 10) / 10,
        time_from_dep_min: Math.round(leg.cumulativeTimeMin),
        fuel_remaining_liters: Math.round(leg.fuelRemainingL * 10) / 10,
      })),
    ];
    const lastLeg = legs[legs.length - 1];
    return {
      origin_icao: legs[0].from.ident,
      destination_icao: lastLeg.to.ident,
      flight_hours: Math.round((minutes / 60) * 100) / 100,
      estimated_flight_time: Math.round((minutes / 60) * 100) / 100,
      distance_km: Math.round(result.totalDistanceNm * 1.852 * 10) / 10,
      encoded_polyline: result.encodedPolyline,
      waypoints,
      flight_type: reservation?.flight_category ?? 'VFR',
      number_of_passengers: reservation?.number_of_passengers ?? 0,
      departure_time: departure,
      arrival_time: new Date(
        departure.getTime() + (TAXI_OUT_MINUTES + minutes) * 60000,
      ),
      weather_conditions: result.weather
        .filter((w) => w.metar)
        .map((w) => w.metar)
        .join(' | ')
        .slice(0, 2000),
      fuel_policy: JSON.stringify({
        taxi_liters: Math.round(result.fuel.taxiL * 10) / 10,
        trip_liters: Math.round(result.fuel.tripL * 10) / 10,
        contingency_liters: Math.round(result.fuel.contingencyL * 10) / 10,
        alternate_liters: Math.round(result.fuel.alternateL * 10) / 10,
        final_reserve_liters: Math.round(result.fuel.finalReserveL * 10) / 10,
        total_liters: Math.round(result.fuel.minimumBlockL * 10) / 10,
      }),
      wind_summary: JSON.stringify({
        wind_dir_deg: legs[0].wind.directionDeg,
        wind_speed_kts: legs[0].wind.speedKt,
        wca_deg: Math.round(legs[0].windCorrectionDeg),
        ground_speed_kts: Math.round(legs[0].groundSpeedKt),
      }),
      estimated_fuel_liters: Math.round(result.fuel.minimumBlockL * 10) / 10,
      plan_engine: PLAN_ENGINE,
    };
  }

  private async checkReservation(
    input: FlightPlanInput,
    requester: SessionUser,
  ): Promise<Reservation | null> {
    const reservation = await this.flights.bookingForNewFlight(
      input.reservationId ?? null,
      requester,
    );
    if (reservation && !sameId(reservation.aircraft?.id, input.aircraftId)) {
      throw localized(BadRequestException, 'error.navplan.aircraftNotBooked');
    }
    return reservation;
  }

  async save(
    input: FlightPlanInput,
    flightPlanId: number | null | undefined,
    requester: SessionUser,
    language: Language,
  ) {
    if (flightPlanId) {
      const plan = await this.plans.findOne({ where: { id: flightPlanId } });
      if (!plan)
        throw localized(NotFoundException, 'error.navplan.planNotFound');
      if (!isAdmin(requester) && !sameId(plan.user_id, requester.id)) {
        throw localized(ForbiddenException, 'error.navplan.notOwnPlan');
      }
      if ((input.reservationId ?? null) !== (plan.reservation_id ?? null)) {
        throw localized(BadRequestException, 'error.navplan.reservationChange');
      }
      const reservation = plan.reservation_id
        ? await this.reservations.findOne({
            where: { id: plan.reservation_id },
            relations: ['aircraft'],
          })
        : null;
      if (reservation && !sameId(reservation.aircraft?.id, input.aircraftId)) {
        throw localized(BadRequestException, 'error.navplan.aircraftNotBooked');
      }
      const result = await this.compute(input);
      if (plan.flight_id) {
        // Owner and closed-flight rules of the flight apply.
        await this.flights.updateFlight(
          plan.flight_id,
          {
            id: plan.flight_id,
            ...this.legacyColumns(result, reservation),
          } as any,
          requester,
        );
      }
      Object.assign(plan, this.planFields(input, result));
      return this.planView(await this.plans.save(plan), language);
    }

    const reservation = await this.checkReservation(input, requester);
    const result = await this.compute(input);
    const pilotId = reservation?.user?.id ?? requester.id;
    const flight: Flight = await this.flights.createFlightByUser(
      {
        reservation_id: reservation?.id ?? null,
        user_id: pilotId,
        ...this.legacyColumns(result, reservation),
      } as any,
      requester,
      language,
    );
    const plan = await this.plans.save(
      this.plans.create({
        flight_id: flight.id,
        reservation_id: reservation?.id ?? null,
        user_id: pilotId,
        aircraft_id: input.aircraftId,
        ...this.planFields(input, result),
      }),
    );
    return this.planView(plan, language);
  }

  private planFields(input: FlightPlanInput, result: FlightPlanResult) {
    return {
      input: JSON.parse(JSON.stringify(input)),
      result: JSON.parse(JSON.stringify(result)),
      engine_version: result.engineVersion,
      navdata_airac: result.navdata.airac.slice(0, 16),
      weather_fetched_at: new Date(),
      status: result.status,
    };
  }

  // The existing "generate a plan" of a booking: a direct route from the
  // departure to the destination with the booked aircraft, at 2500 ft or
  // the requested altitude, fuel full, pilot only.
  async directPlanForBooking(
    reservation: Reservation,
    originIcao: string,
    destinationIcao: string,
    departureTime: Date,
    cruiseAltitudeFt: number | null,
  ) {
    const [departure, destination] = await Promise.all([
      this.navdata.aerodromePoint(originIcao),
      this.navdata.aerodromePoint(destinationIcao),
    ]);
    const data = await this.aircraftData.flightData(reservation.aircraft.id);
    const performance = data.performance ?? fleetPerformance(data.aircraft);
    const altitude =
      cruiseAltitudeFt ??
      Math.max(
        2500,
        Math.ceil(((departure.elevationFt ?? 0) + 1500) / 500) * 500,
      );
    const input: FlightPlanInput = {
      aircraftId: reservation.aircraft.id,
      reservationId: reservation.id,
      departureTime,
      departure: { navPointId: departure.id },
      destination: { navPointId: destination.id },
      alternate: null,
      waypoints: [],
      legs: [{ altitudeFt: altitude }],
      reserveCase: 'VFR_DAY' as any,
      qnhHpa: null,
      loads: [],
      fuel: performance.fuel.tanks.map((t) => ({
        tankId: t.id,
        liters: t.usableL,
      })),
      envelopeCategory: 'NORMAL' as any,
    };
    const result = await this.compute(input);
    return {
      result,
      legacy: this.legacyColumns(result, reservation),
      persist: async (flightId: number, pilotId: number) => {
        await this.plans.save(
          this.plans.create({
            flight_id: flightId,
            reservation_id: reservation.id,
            user_id: pilotId,
            aircraft_id: reservation.aircraft.id,
            ...this.planFields(input, result),
          }),
        );
      },
    };
  }

  async exportPdf(
    id: number,
    format: 'A4' | 'A5',
    requester: SessionUser,
    language: Language,
  ): Promise<string> {
    const plan = await this.plans.findOne({
      where: { id },
      relations: ['user', 'aircraft'],
    });
    if (!plan) throw localized(NotFoundException, 'error.navplan.planNotFound');
    await this.assertCanRead(plan, requester);
    const massBalance = plan.aircraft_id
      ? await this.aircraftData.getMassBalance(plan.aircraft_id)
      : null;
    return buildDossierPdf({
      result: plan.result as unknown as FlightPlanResult,
      format,
      language,
      pilot: plan.user
        ? `${plan.user.first_name ?? ''} ${plan.user.last_name ?? ''}`.trim()
        : '',
      aircraft: plan.aircraft
        ? `${plan.aircraft.registration_number} (${plan.aircraft.model})`
        : '',
      weighingDate: massBalance?.weighingDate ?? null,
    });
  }
}
