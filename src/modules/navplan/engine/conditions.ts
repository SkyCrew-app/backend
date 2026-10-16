import { isNight, sunTimes } from './solar';
import { CheckStatus, MessageRef } from './types';

// Night and weather validity of a plan against its own times. Everything is
// in UTC; the times shown to the pilot are written "HH:MM UTC".

// OWNER DECISION — the engine's times stop overhead the destination at
// circuit height: the circuit and the landing are counted as this many
// minutes when deciding whether the flight ends at night.
export const CIRCUIT_AND_LANDING_MIN = 5;
// OWNER DECISION — a flight ending less than this before the end of the
// evening civil twilight is flagged: any delay makes it a night flight.
export const NIGHT_MARGIN_MIN = 30;
// OWNER DECISION — a METAR older than this at the planned off-block time no
// longer gives the departure QNH.
export const METAR_MAX_AGE_MIN = 60;

export type AerodromeRole = 'departure' | 'destination' | 'alternate';

export interface TimedPoint {
  lat: number;
  lon: number;
}

/** A stretch of the flight flown in a straight line between two instants. */
export interface FlightStretch {
  from: TimedPoint;
  to: TimedPoint;
  start: Date;
  end: Date;
}

export interface AerodromeSun {
  icao: string;
  role: AerodromeRole;
  /** The time of the flight at that aerodrome: off-block, landing or arrival at the alternate. */
  at: Date;
  date: string;
  civilDawn: Date | null;
  sunrise: Date | null;
  sunset: Date | null;
  civilDusk: Date | null;
}

export interface Daylight {
  aerodromes: AerodromeSun[];
  /** Some part of the flight (off-block to landing, alternate included) is at night. */
  night: boolean;
  /** First instant of the flight at night, null when none. */
  nightFrom: Date | null;
}

export interface Condition {
  code: string;
  status: CheckStatus;
  message: MessageRef;
}

export const utcTime = (value: Date, reference?: Date): string => {
  const iso = value.toISOString();
  const time = `${iso.slice(11, 16)} UTC`;
  if (reference && reference.toISOString().slice(0, 10) === iso.slice(0, 10))
    return time;
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${time}`;
};

const SAMPLE_MS = 60_000;

/**
 * The aviation night along the flight: every minute of each stretch is
 * checked at the aircraft's position (interpolated along the stretch), so a
 * flight that only enters the night half-way is caught.
 */
export function daylightOf(
  stretches: FlightStretch[],
  aerodromes: {
    icao: string;
    role: AerodromeRole;
    point: TimedPoint;
    at: Date;
  }[],
): Daylight {
  let nightFrom: Date | null = null;
  for (const stretch of stretches) {
    const start = stretch.start.getTime();
    const end = Math.max(start, stretch.end.getTime());
    for (let time = start; ; time = Math.min(end, time + SAMPLE_MS)) {
      const f = end === start ? 0 : (time - start) / (end - start);
      const lat = stretch.from.lat + (stretch.to.lat - stretch.from.lat) * f;
      const lon = stretch.from.lon + (stretch.to.lon - stretch.from.lon) * f;
      if (isNight(lat, lon, new Date(time))) {
        if (!nightFrom || time < nightFrom.getTime())
          nightFrom = new Date(time);
        break;
      }
      if (time >= end) break;
    }
  }
  return {
    aerodromes: aerodromes.map(({ icao, role, point, at }) => ({
      icao,
      role,
      at,
      ...sunTimes(point.lat, point.lon, at),
    })),
    night: nightFrom !== null,
    nightFrom,
  };
}

/** Night notices: the night itself, and a landing close to the end of the evening twilight. */
export function nightConditions(
  daylight: Daylight,
  imposed: boolean,
): Condition[] {
  const conditions: Condition[] = [];
  if (daylight.night && daylight.nightFrom) {
    conditions.push({
      code: 'NIGHT_FLIGHT',
      status: 'WARNING',
      message: {
        key: imposed
          ? 'navplan.notice.nightReserveImposed'
          : 'navplan.notice.nightFlight',
        params: { time: utcTime(daylight.nightFrom) },
      },
    });
    return conditions;
  }
  for (const aerodrome of daylight.aerodromes) {
    if (aerodrome.role === 'departure' || !aerodrome.civilDusk) continue;
    const left =
      (aerodrome.civilDusk.getTime() - aerodrome.at.getTime()) / 60000;
    if (left >= 0 && left < NIGHT_MARGIN_MIN) {
      conditions.push({
        code: 'NIGHT_APPROACHING',
        status: 'WARNING',
        message: {
          key: 'navplan.notice.nightApproaching',
          params: {
            icao: aerodrome.icao,
            role: aerodrome.role,
            arrival: utcTime(aerodrome.at),
            dusk: utcTime(aerodrome.civilDusk),
            minutes: Math.floor(left),
          },
        },
      });
    }
  }
  return conditions;
}

export interface ForecastReport {
  icao: string;
  metar: string | null;
  taf: string | null;
  observedAt: Date | null;
  tafValidFrom?: Date | null;
  tafValidTo?: Date | null;
}

/**
 * The weather checked against the times of the flight: the METAR that gave
 * the QNH, the TAF of each aerodrome of the plan at the time the aircraft is
 * there, and the range of the winds aloft forecast. Never silent: what is
 * not covered is said.
 */
export function weatherConditions(input: {
  departureTime: Date;
  qnhSource: 'INPUT' | 'METAR' | 'DEFAULT';
  qnhStation: string | null;
  qnhObservedAt: Date | null;
  reports: ForecastReport[];
  aerodromes: { icao: string; role: AerodromeRole; at: Date }[];
  winds: { from: Date; to: Date; run: string } | null;
  flightStart: Date;
  flightEnd: Date;
  windFallbackUsed: boolean;
}): Condition[] {
  const conditions: Condition[] = [];
  const add = (
    code: string,
    key: string,
    params: Record<string, string | number>,
  ) => conditions.push({ code, status: 'WARNING', message: { key, params } });

  if (input.qnhSource === 'METAR') {
    if (!input.qnhObservedAt) {
      add('QNH_METAR_OLD', 'navplan.notice.qnhMetarUnknownTime', {
        icao: input.qnhStation ?? '',
      });
    } else if (
      input.departureTime.getTime() - input.qnhObservedAt.getTime() >
      METAR_MAX_AGE_MIN * 60000
    ) {
      add('QNH_METAR_OLD', 'navplan.notice.qnhMetarOld', {
        icao: input.qnhStation ?? '',
        time: utcTime(input.qnhObservedAt, input.departureTime),
      });
    }
  }

  for (const aerodrome of input.aerodromes) {
    const report = input.reports.find((r) => r.icao === aerodrome.icao);
    const at = utcTime(aerodrome.at);
    const params = { icao: aerodrome.icao, role: aerodrome.role, time: at };
    if (report?.taf) {
      const from = report.tafValidFrom ? new Date(report.tafValidFrom) : null;
      const to = report.tafValidTo ? new Date(report.tafValidTo) : null;
      if (!from || !to) {
        add('TAF_NOT_COVERING', 'navplan.notice.tafValidityUnknown', params);
      } else if (
        aerodrome.at.getTime() < from.getTime() ||
        aerodrome.at.getTime() > to.getTime()
      ) {
        add('TAF_NOT_COVERING', 'navplan.notice.tafNotCovering', {
          ...params,
          from: utcTime(from),
          to: utcTime(to),
        });
      }
    } else if (aerodrome.role !== 'departure') {
      add('TAF_MISSING', 'navplan.notice.tafMissing', params);
    } else {
      // No TAF at the departure: only an old observation describes it.
      const observed = report?.observedAt ? new Date(report.observedAt) : null;
      if (
        !observed ||
        aerodrome.at.getTime() - observed.getTime() > METAR_MAX_AGE_MIN * 60000
      ) {
        add('DEPARTURE_NO_FORECAST', 'navplan.notice.departureNoForecast', {
          ...params,
          observed: observed ? utcTime(observed, aerodrome.at) : '—',
        });
      }
    }
  }

  if (input.windFallbackUsed && input.winds) {
    const outside =
      input.flightStart.getTime() < input.winds.from.getTime() ||
      input.flightEnd.getTime() > input.winds.to.getTime();
    if (outside) {
      add('WIND_OUT_OF_RANGE', 'navplan.notice.windOutOfRange', {
        run: input.winds.run,
        from: utcTime(input.winds.from),
        to: utcTime(input.winds.to),
      });
    }
  }
  return conditions;
}
