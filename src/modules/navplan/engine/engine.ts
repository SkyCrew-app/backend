import * as polyline from 'polyline';
import {
  AirspaceCrossing,
  AirspaceRecord,
  legCrossings,
} from './airspace-intersection';
import {
  isaTemperatureC,
  pressureAltitudeFt,
  STANDARD_PRESSURE_HPA,
} from './atmosphere';
import { FuelPlan, FuelSettings, planFuel, ReserveCase } from './fuel';
import { legGeometry, normalizeDeg } from './geodesy';
import {
  burnFuel,
  computeMassBalance,
  emptyMassBalanceResult,
  MassBalanceResult,
} from './mass-balance';
import { cruiseAt, PerformanceError } from './performance';
import { suggestedVfrAltitudeFt } from './semicircular';
import {
  CheckStatus,
  EnvelopeCategory,
  MassBalanceData,
  MessageRef,
  PerformanceData,
  worstStatus,
} from './types';
import {
  buildProfile,
  PhaseSegment,
  ProfileLeg,
  ProfilePoint,
  WindSample,
} from './vertical-profile';
import { solveWindTriangle, WindTriangleError } from './wind-triangle';
import { declinationAt, WmmExpiredError } from './wmm';

export const ENGINE_VERSION = 'navplan-1.0.0';

// OWNER DECISION — minutes between off-block and take-off used for the
// estimated times (the taxi fuel is the aircraft's own figure).
export const TAXI_OUT_MINUTES = 10;

export type NavPointType =
  | 'AERODROME'
  | 'VOR'
  | 'VOR_DME'
  | 'NDB'
  | 'DME'
  | 'TACAN'
  | 'VRP'
  | 'USER';

export interface EnginePoint {
  id: string;
  type: NavPointType;
  ident: string;
  name: string | null;
  lat: number;
  lon: number;
  elevationFt: number | null;
  frequency: string | null;
  aerodromeIcao: string | null;
  mandatory: boolean | null;
}

export type DataSourceKind = 'METAR' | 'TAF' | 'MODEL' | 'PILOT' | 'NONE';

export interface WindForecast extends WindSample {
  validAt: Date | null;
}

export type WindProvider = (
  lat: number,
  lon: number,
  altitudeFt: number,
  time: Date,
) => WindForecast | null;

export interface EngineLegInput {
  altitudeFt: number;
  cruiseSetting: string | null;
  windOverride: {
    directionDeg: number;
    speedKt: number;
    temperatureC: number | null;
  } | null;
}

export interface EngineSettings extends FuelSettings {
  verticalMarginFt: number;
  defaultCircuitHeightFt: number;
  defaultDescentFpm: number;
}

export interface NavdataStatus {
  airac: string;
  effectiveFrom: Date;
  effectiveTo: Date;
  stale: boolean;
  cyclesBehind: number;
  source: string;
  hasAirspaces: boolean;
}

export interface WeatherReport {
  icao: string;
  metar: string | null;
  taf: string | null;
  observedAt: Date | null;
}

export interface EngineInput {
  departureTime: Date;
  departure: EnginePoint;
  destination: EnginePoint;
  alternate: EnginePoint | null;
  waypoints: EnginePoint[];
  legs: EngineLegInput[];
  reserveCase: ReserveCase;
  qnhHpa: number;
  qnhSource: 'INPUT' | 'METAR' | 'DEFAULT';
  loads: { stationId: string; massKg: number | null }[];
  fuel: { tankId: string; liters: number }[];
  envelopeCategory: EnvelopeCategory;
  performance: PerformanceData;
  performanceStatus: 'VALIDATED' | 'NOT_VALIDATED' | 'FLEET_DATA_ONLY';
  massBalance: MassBalanceData | null;
  massBalanceValidated: boolean;
  settings: EngineSettings;
  circuitHeightFt: number | null;
  airspaces: AirspaceRecord[];
  navdata: NavdataStatus;
  wind: WindProvider | null;
  windSource: string;
  weather: WeatherReport[];
}

export interface LegWind {
  directionDeg: number;
  speedKt: number;
  temperatureC: number | null;
  source: DataSourceKind;
  validAt: Date | null;
}

export interface LegResult {
  index: number;
  from: EnginePoint;
  to: EnginePoint;
  distanceNm: number;
  trueCourseDeg: number;
  variationDeg: number;
  magneticCourseDeg: number;
  wind: LegWind;
  windCorrectionDeg: number;
  trueHeadingDeg: number;
  magneticHeadingDeg: number;
  tasKt: number;
  groundSpeedKt: number;
  altitudeFt: number;
  suggestedAltitudeFt: number | null;
  segments: PhaseSegment[];
  timeMin: number;
  cumulativeTimeMin: number;
  eta: Date;
  fuelL: number;
  fuelRemainingL: number;
  crossings: AirspaceCrossing[];
}

export interface Notice {
  code: string;
  status: CheckStatus;
  message: MessageRef;
}

export interface FlightPlanResult {
  legs: LegResult[];
  alternateLeg: LegResult | null;
  profile: ProfilePoint[];
  totalDistanceNm: number;
  totalTimeMin: number;
  fuel: FuelPlan;
  massBalance: MassBalanceResult;
  weather: WeatherReport[];
  windSource: string;
  navdata: {
    airac: string;
    effectiveFrom: Date;
    effectiveTo: Date;
    stale: boolean;
    source: string;
  };
  engineVersion: string;
  status: CheckStatus;
  notices: Notice[];
  encodedPolyline: string;
  // Not in the GraphQL result: kept with the saved plan for the PDF.
  qnhHpa: number;
  departureTime: Date;
}

interface LegContext {
  from: EnginePoint;
  to: EnginePoint;
  input: EngineLegInput;
}

const ZERO_WIND: WindForecast = {
  fromDeg: 0,
  speedKt: 0,
  temperatureC: null,
  validAt: null,
};

export function computeFlightPlan(input: EngineInput): FlightPlanResult {
  const notices: Notice[] = [];
  const notice = (
    code: string,
    status: CheckStatus,
    key: string,
    params?: Record<string, string | number>,
  ) => notices.push({ code, status, message: { key, params } });

  notice('DISCLAIMER', 'OK', 'navplan.notice.disclaimer');
  notice('NOTAM_CHECK', 'WARNING', 'navplan.notice.notamCheck');

  if (input.navdata.stale) {
    notice('NAVDATA_STALE', 'WARNING', 'navplan.notice.navdataStale', {
      airac: input.navdata.airac,
      date: input.navdata.effectiveFrom.toISOString().slice(0, 10),
    });
  }
  if (!input.navdata.hasAirspaces) {
    notice('NAVDATA_NO_AIRSPACE', 'WARNING', 'navplan.notice.noAirspaceData');
  }
  if (input.qnhSource === 'DEFAULT') {
    notice('QNH_DEFAULTED', 'WARNING', 'navplan.notice.qnhDefaulted');
  }
  if (input.performanceStatus === 'NOT_VALIDATED') {
    notice('PERF_NOT_VALIDATED', 'BLOCKING', 'navplan.notice.perfNotValidated');
  }
  if (input.performanceStatus === 'FLEET_DATA_ONLY') {
    notice('PERF_MISSING', 'BLOCKING', 'navplan.notice.perfMissing');
  }

  const points = [input.departure, ...input.waypoints, input.destination];
  const contexts: LegContext[] = input.legs.map((leg, i) => ({
    from: points[i],
    to: points[i + 1],
    input: leg,
  }));
  const settingOf = (leg: EngineLegInput) =>
    leg.cruiseSetting || input.performance.cruise.normalSetting;
  const takeoffTime = new Date(
    input.departureTime.getTime() + TAXI_OUT_MINUTES * 60000,
  );

  let wmmExpired = false;
  const variationAt = (lat: number, lon: number) => {
    try {
      return declinationAt(lat, lon, takeoffTime);
    } catch (error) {
      if (error instanceof WmmExpiredError) {
        wmmExpired = true;
        return 0;
      }
      throw error;
    }
  };

  let windMissing = false;
  const windFor = (
    leg: EngineLegInput,
    lat: number,
    lon: number,
    time: Date,
  ): ((alt: number) => WindForecast & { source: DataSourceKind }) => {
    return (alt: number) => {
      if (leg.windOverride) {
        return {
          fromDeg: leg.windOverride.directionDeg,
          speedKt: leg.windOverride.speedKt,
          temperatureC: leg.windOverride.temperatureC ?? null,
          validAt: null,
          source: 'PILOT',
        };
      }
      const forecast = input.wind ? input.wind(lat, lon, alt, time) : null;
      if (!forecast) {
        windMissing = true;
        return { ...ZERO_WIND, source: 'NONE' };
      }
      return { ...forecast, source: 'MODEL' };
    };
  };

  const build = (
    legContexts: LegContext[],
    startAlt: number,
    endAlt: number,
    startTime: Date,
  ) => {
    // Times are first estimated without wind, to read the forecast at about
    // the right hour.
    let elapsed = 0;
    const geometries = legContexts.map((context) =>
      legGeometry(context.from, context.to),
    );
    const profileLegs: (Omit<ProfileLeg, 'windAt'> & {
      windAt: ReturnType<typeof windFor>;
    })[] = legContexts.map((context, i) => {
      const geometry = geometries[i];
      let tas = 100;
      try {
        tas = cruiseAt(
          input.performance.cruise,
          settingOf(context.input),
          pressureAltitudeFt(context.input.altitudeFt, input.qnhHpa),
          0,
        ).tasKt;
      } catch {
        // Reported below by the profile itself.
      }
      const midTime = new Date(
        startTime.getTime() +
          (elapsed + (geometry.distanceNm / 2 / tas) * 60) * 60000,
      );
      elapsed += (geometry.distanceNm / tas) * 60;
      return {
        distanceNm: geometry.distanceNm,
        trueCourseDeg: geometry.midCourseDeg,
        altitudeFt: context.input.altitudeFt,
        cruiseSetting: settingOf(context.input),
        windAt: windFor(
          context.input,
          geometry.midpoint.lat,
          geometry.midpoint.lon,
          midTime,
        ),
      };
    });
    const profile = buildProfile({
      legs: profileLegs,
      startAltitudeFt: startAlt,
      endAltitudeFt: endAlt,
      qnhHpa: input.qnhHpa,
      performance: input.performance,
      descentRateFpm:
        input.performance.descent.rateFpm || input.settings.defaultDescentFpm,
    });
    return { geometries, profileLegs, profile };
  };

  const circuitHeight =
    input.circuitHeightFt ?? input.settings.defaultCircuitHeightFt;
  const startAlt = input.departure.elevationFt ?? 0;
  const endAlt = (input.destination.elevationFt ?? 0) + circuitHeight;

  let built: ReturnType<typeof build>;
  try {
    built = build(contexts, startAlt, endAlt, takeoffTime);
  } catch (error) {
    if (error instanceof PerformanceError) {
      return failedPlan(input, notices, error);
    }
    throw error;
  }

  const legs: LegResult[] = [];
  let cumulativeTime = 0;
  let cumulativeFuel = 0;
  let cumulativeDistance = 0;
  const loadedL = input.fuel.reduce(
    (sum, f) => sum + (Number(f.liters) || 0),
    0,
  );
  const taxiL = input.performance.fuel.taxiFuelL;
  const navdataTooOld = input.navdata.cyclesBehind > 2;

  const makeLeg = (
    context: LegContext,
    index: number,
    geometry: ReturnType<typeof legGeometry>,
    profileLeg: (typeof built.profileLegs)[number],
    segments: PhaseSegment[],
    legStartNm: number,
    altitudeAt: (x: number) => number,
    baseTime: number,
    baseFuel: number,
    startTime: Date,
  ): LegResult => {
    const variation = variationAt(geometry.midpoint.lat, geometry.midpoint.lon);
    const wind = profileLeg.windAt(context.input.altitudeFt);
    const zp = pressureAltitudeFt(context.input.altitudeFt, input.qnhHpa);
    const temperature = wind.temperatureC ?? isaTemperatureC(zp);
    let tas = 0;
    try {
      tas = cruiseAt(
        input.performance.cruise,
        settingOf(context.input),
        zp,
        temperature - isaTemperatureC(zp),
      ).tasKt;
    } catch {
      tas =
        segments.find((s) => s.phase === 'CRUISE')?.tasKt ??
        segments[0]?.tasKt ??
        0;
    }
    let wca = 0;
    let gs = tas;
    try {
      const triangle = solveWindTriangle(
        geometry.midCourseDeg,
        tas,
        wind.fromDeg,
        wind.speedKt,
      );
      wca = triangle.windCorrectionDeg;
      gs = triangle.groundSpeedKt;
    } catch (error) {
      if (!(error instanceof WindTriangleError)) throw error;
    }
    const timeMin = segments.reduce((sum, s) => sum + s.timeMin, 0);
    const fuelL = segments.reduce((sum, s) => sum + s.fuelL, 0);
    const magneticCourse = normalizeDeg(geometry.midCourseDeg - variation);
    const trueHeading = normalizeDeg(geometry.midCourseDeg + wca);
    return {
      index,
      from: context.from,
      to: context.to,
      distanceNm: geometry.distanceNm,
      trueCourseDeg: geometry.midCourseDeg,
      variationDeg: variation,
      magneticCourseDeg: magneticCourse,
      wind: {
        directionDeg: Math.round(wind.fromDeg),
        speedKt: Math.round(wind.speedKt),
        temperatureC: wind.temperatureC,
        source: wind.source,
        validAt: wind.validAt,
      },
      windCorrectionDeg: wca,
      trueHeadingDeg: trueHeading,
      magneticHeadingDeg: normalizeDeg(trueHeading - variation),
      tasKt: tas,
      groundSpeedKt: gs,
      altitudeFt: context.input.altitudeFt,
      suggestedAltitudeFt: suggestedVfrAltitudeFt(
        magneticCourse,
        context.input.altitudeFt,
      ),
      segments,
      timeMin,
      cumulativeTimeMin: baseTime + timeMin,
      eta: new Date(startTime.getTime() + (baseTime + timeMin) * 60000),
      fuelL,
      fuelRemainingL: loadedL - taxiL - baseFuel - fuelL,
      crossings: legCrossings(
        {
          from: context.from,
          to: context.to,
          distanceNm: geometry.distanceNm,
          altitudeAt: (x) => altitudeAt(legStartNm + x),
        },
        input.airspaces,
        input.qnhHpa,
        input.settings.verticalMarginFt,
        { verticalUnknown: navdataTooOld },
      ),
    };
  };

  contexts.forEach((context, i) => {
    const leg = makeLeg(
      context,
      i,
      built.geometries[i],
      built.profileLegs[i],
      built.profile.segmentsByLeg[i],
      cumulativeDistance,
      built.profile.altitudeAt,
      cumulativeTime,
      cumulativeFuel,
      takeoffTime,
    );
    legs.push(leg);
    cumulativeTime += leg.timeMin;
    cumulativeFuel += leg.fuelL;
    cumulativeDistance += leg.distanceNm;
  });

  for (const issue of built.profile.issues) {
    if (issue.code === 'CRUISE_TEMPERATURE_IGNORED') {
      notice(
        issue.code,
        'WARNING',
        'navplan.notice.cruiseTemperatureIgnored',
        issue.params,
      );
    } else {
      notice(
        issue.code,
        'BLOCKING',
        'navplan.notice.windExceedsTas',
        issue.params,
      );
    }
  }

  // Alternate: direct from the destination at the last leg's altitude,
  // from a go-around at the destination down to the alternate's circuit.
  let alternateLeg: LegResult | null = null;
  if (input.alternate) {
    const lastLeg = input.legs[input.legs.length - 1];
    const context: LegContext = {
      from: input.destination,
      to: input.alternate,
      input: {
        altitudeFt: lastLeg.altitudeFt,
        cruiseSetting: lastLeg.cruiseSetting,
        windOverride: lastLeg.windOverride,
      },
    };
    try {
      const startTime = new Date(
        takeoffTime.getTime() + cumulativeTime * 60000,
      );
      const alternateBuilt = build(
        [context],
        input.destination.elevationFt ?? 0,
        (input.alternate.elevationFt ?? 0) + circuitHeight,
        startTime,
      );
      alternateLeg = makeLeg(
        context,
        legs.length,
        alternateBuilt.geometries[0],
        alternateBuilt.profileLegs[0],
        alternateBuilt.profile.segmentsByLeg[0],
        0,
        alternateBuilt.profile.altitudeAt,
        cumulativeTime,
        cumulativeFuel,
        takeoffTime,
      );
    } catch (error) {
      if (!(error instanceof PerformanceError)) throw error;
      notice(
        'ALTERNATE_NOT_COMPUTED',
        'BLOCKING',
        'navplan.notice.performanceOutOfTable',
        {
          detail: error.code,
        },
      );
    }
  }

  if (wmmExpired)
    notice('WMM_EXPIRED', 'BLOCKING', 'navplan.notice.wmmExpired');
  if (windMissing)
    notice('WIND_UNAVAILABLE', 'WARNING', 'navplan.notice.windUnavailable');
  if (legs.some((leg) => leg.wind.source === 'PILOT')) {
    notice('WIND_PILOT', 'OK', 'navplan.notice.windPilot');
  }

  // Fuel.
  const firstLeg = input.legs[0];
  let cruiseFlow = 0;
  try {
    cruiseFlow = cruiseAt(
      input.performance.cruise,
      input.performance.cruise.normalSetting,
      pressureAltitudeFt(firstLeg.altitudeFt, input.qnhHpa),
      0,
    ).fuelFlowLph;
  } catch {
    cruiseFlow = legs[0]?.segments.find((s) => s.phase === 'CRUISE')
      ? (legs[0].fuelL / Math.max(legs[0].timeMin, 1e-9)) * 60
      : 0;
  }
  const usableByTank = new Map(
    input.performance.fuel.tanks.map((t) => [t.id, t]),
  );
  const usableL = input.performance.fuel.tanks.reduce(
    (sum, t) => sum + t.usableL,
    0,
  );
  const fuel = planFuel({
    reserveCase: input.reserveCase,
    settings: input.settings,
    taxiL,
    tripL: cumulativeFuel,
    alternateL: alternateLeg?.fuelL ?? 0,
    hasAlternate: !!alternateLeg,
    arrivalFuelL: input.performance.arrivalFuelL,
    holdingFuelFlowLph: input.performance.reserve.holdingFuelFlowLph,
    maxContinuousFuelFlowLph:
      input.performance.reserve.maxContinuousFuelFlowLph,
    cruiseFuelFlowLph: cruiseFlow,
    loadedL,
    usableL,
  });
  for (const load of input.fuel) {
    const tank = usableByTank.get(load.tankId);
    if (!tank) {
      fuel.status = 'BLOCKING';
      fuel.messages.push({
        key: 'navplan.fuel.unknownTank',
        params: { tank: load.tankId },
      });
    } else if (load.liters > tank.usableL + 1e-9) {
      fuel.status = 'BLOCKING';
      fuel.messages.push({
        key: 'navplan.fuel.tankAboveUsable',
        params: { tank: tank.label, loaded: load.liters, usable: tank.usableL },
      });
    } else if (load.liters < 0) {
      fuel.status = 'BLOCKING';
      fuel.messages.push({
        key: 'navplan.fuel.negative',
        params: { tank: tank.label },
      });
    }
  }

  // Mass and balance.
  let massBalance: MassBalanceResult;
  if (!input.massBalance || !input.massBalanceValidated) {
    massBalance = emptyMassBalanceResult(input.envelopeCategory, [
      { key: 'navplan.mb.notValidated' },
    ]);
    notice('MB_NOT_VALIDATED', 'BLOCKING', 'navplan.mb.notValidated');
  } else {
    const block: Record<string, number> = {};
    for (const load of input.fuel)
      block[load.tankId] = (block[load.tankId] ?? 0) + load.liters;
    const order = input.performance.fuel.burnOrder ?? [];
    const takeoffFuel = burnFuel(block, taxiL, order);
    const landingFuel = burnFuel(takeoffFuel, fuel.tripL, order);
    massBalance = computeMassBalance({
      data: input.massBalance,
      loads: input.loads,
      fuelTakeoffL: takeoffFuel,
      fuelLandingL: landingFuel,
      fuelArmByTank: Object.fromEntries(
        input.performance.fuel.tanks.map((t) => [t.id, t.armM]),
      ),
      fuelLabelByTank: Object.fromEntries(
        input.performance.fuel.tanks.map((t) => [t.id, t.label]),
      ),
      densityKgPerL: input.performance.fuel.densityKgPerL,
      category: input.envelopeCategory,
    });
  }

  const crossingStatuses = [
    ...legs,
    ...(alternateLeg ? [alternateLeg] : []),
  ].flatMap((leg) => leg.crossings.map((c) => c.status));
  const status = worstStatus(
    ...notices.map((n) => n.status),
    fuel.status,
    massBalance.status,
    ...crossingStatuses,
  );

  const route = points.map((p) => [p.lat, p.lon] as [number, number]);
  return {
    legs,
    alternateLeg,
    profile: built.profile.points,
    totalDistanceNm: cumulativeDistance,
    totalTimeMin: cumulativeTime,
    fuel,
    massBalance,
    weather: input.weather,
    windSource: input.windSource,
    navdata: {
      airac: input.navdata.airac,
      effectiveFrom: input.navdata.effectiveFrom,
      effectiveTo: input.navdata.effectiveTo,
      stale: input.navdata.stale,
      source: input.navdata.source,
    },
    engineVersion: ENGINE_VERSION,
    status,
    notices,
    encodedPolyline: polyline.encode(route),
    qnhHpa: input.qnhHpa,
    departureTime: input.departureTime,
  };
}

// A plan whose performance tables do not cover the flight: the route is
// still described, every time and fuel figure is zero and the plan is
// blocked with the reason.
function failedPlan(
  input: EngineInput,
  notices: Notice[],
  error: PerformanceError,
): FlightPlanResult {
  notices.push({
    code: 'PERFORMANCE_OUT_OF_TABLE',
    status: 'BLOCKING',
    message: {
      key:
        error.code === 'OUT_OF_TABLE'
          ? 'navplan.notice.performanceOutOfTable'
          : 'navplan.notice.performanceIncomplete',
      params: {
        detail: `${error.code} ${Object.values(error.params).join(' ')}`.trim(),
      },
    },
  });
  const points = [input.departure, ...input.waypoints, input.destination];
  const legs: LegResult[] = input.legs.map((leg, i) => {
    const geometry = legGeometry(points[i], points[i + 1]);
    return {
      index: i,
      from: points[i],
      to: points[i + 1],
      distanceNm: geometry.distanceNm,
      trueCourseDeg: geometry.midCourseDeg,
      variationDeg: 0,
      magneticCourseDeg: geometry.midCourseDeg,
      wind: {
        directionDeg: 0,
        speedKt: 0,
        temperatureC: null,
        source: 'NONE',
        validAt: null,
      },
      windCorrectionDeg: 0,
      trueHeadingDeg: geometry.midCourseDeg,
      magneticHeadingDeg: geometry.midCourseDeg,
      tasKt: 0,
      groundSpeedKt: 0,
      altitudeFt: leg.altitudeFt,
      suggestedAltitudeFt: null,
      segments: [],
      timeMin: 0,
      cumulativeTimeMin: 0,
      eta: input.departureTime,
      fuelL: 0,
      fuelRemainingL: 0,
      crossings: [],
    };
  });
  const loadedL = input.fuel.reduce(
    (sum, f) => sum + (Number(f.liters) || 0),
    0,
  );
  return {
    legs,
    alternateLeg: null,
    profile: [],
    totalDistanceNm: legs.reduce((s, l) => s + l.distanceNm, 0),
    totalTimeMin: 0,
    fuel: {
      taxiL: 0,
      tripL: 0,
      contingencyL: 0,
      alternateL: 0,
      finalReserveL: 0,
      finalReserveMin: 0,
      clubMarginL: 0,
      minimumBlockL: 0,
      loadedL,
      extraL: 0,
      landingL: 0,
      landingAtAlternateL: null,
      usableL: input.performance.fuel.tanks.reduce((s, t) => s + t.usableL, 0),
      enduranceMin: 0,
      status: 'BLOCKING',
      messages: [{ key: 'navplan.fuel.notComputed' }],
    },
    massBalance: emptyMassBalanceResult(input.envelopeCategory, [
      { key: 'navplan.fuel.notComputed' },
    ]),
    weather: input.weather,
    windSource: input.windSource,
    navdata: {
      airac: input.navdata.airac,
      effectiveFrom: input.navdata.effectiveFrom,
      effectiveTo: input.navdata.effectiveTo,
      stale: input.navdata.stale,
      source: input.navdata.source,
    },
    engineVersion: ENGINE_VERSION,
    status: 'BLOCKING',
    notices,
    encodedPolyline: polyline.encode(points.map((p) => [p.lat, p.lon])),
    qnhHpa: input.qnhHpa ?? STANDARD_PRESSURE_HPA,
    departureTime: input.departureTime,
  };
}
