import { computeFlightPlan, WindForecast } from '../engine';
import {
  CIRCUIT_AND_LANDING_MIN,
  NIGHT_MARGIN_MIN,
  utcTime,
} from '../conditions';
import { isNight, solarElevationDeg, sunTimes } from '../solar';
import { tafValidity } from '../../weather/metar-taf.service';
import { engineInput, LFRD, LFRN, LFRS } from './fixture';

const at = (iso: string) => new Date(iso);
const minutesBetween = (a: Date | null, b: string) =>
  Math.abs((a as Date).getTime() - new Date(b).getTime()) / 60000;

describe('sun (NOAA solar calculator algorithm)', () => {
  // NOAA Global Monitoring Laboratory solar calculator, yearly tables
  // (gml.noaa.gov/grad/solcalc/table.php, 2026, read on 2026-10-16), local
  // times converted to UTC; the tables round to the minute.
  it.each([
    ['LFRS Nantes', 47.1532, -1.6107, '2026-10-16', '06:26', '17:17'],
    ['LFPN Toussus', 48.7519, 2.1062, '2026-06-21', '03:48', '19:58'],
    ['LFPN Toussus', 48.7519, 2.1062, '2026-12-21', '07:42', '15:57'],
    ['LFPN Toussus', 48.7519, 2.1062, '2026-10-25', '06:27', '16:43'],
    ['LFMN Nice', 43.6584, 7.2159, '2026-12-21', '07:01', '15:57'],
    ['LFRB Brest', 48.4479, -4.4185, '2026-06-21', '04:16', '20:23'],
    ['LFRB Brest', 48.4479, -4.4185, '2026-10-25', '06:53', '17:10'],
  ])(
    '%s on %s: sunrise and sunset within a minute of NOAA',
    (_name, lat, lon, date, sunrise, sunset) => {
      const sun = sunTimes(lat, lon, at(`${date}T12:00:00Z`));
      expect(sun.date).toBe(date);
      expect(
        minutesBetween(sun.sunrise, `${date}T${sunrise}:00Z`),
      ).toBeLessThan(1);
      expect(minutesBetween(sun.sunset, `${date}T${sunset}:00Z`)).toBeLessThan(
        1,
      );
    },
  );

  // Civil twilight (sun 6° below the horizon): sunrise-sunset.org (same
  // NOAA equations), read on 2026-10-16; LFRS on 16/10 is the reality
  // check's night flight (end of civil twilight 17:48Z).
  it.each([
    [47.1532, -1.6107, '2026-10-16', '05:55:26', '17:48:32'],
    [48.7519, 2.1062, '2026-06-21', '03:06:01', '20:40:46'],
    [43.6584, 7.2159, '2026-12-21', '06:28:33', '16:29:49'],
    [48.4479, -4.4185, '2026-10-25', '06:20:43', '17:42:45'],
  ])(
    '%f, %f on %s: civil twilight within a minute',
    (lat, lon, date, dawn, dusk) => {
      const sun = sunTimes(lat, lon, at(`${date}T12:00:00Z`));
      expect(minutesBetween(sun.civilDawn, `${date}T${dawn}Z`)).toBeLessThan(1);
      expect(minutesBetween(sun.civilDusk, `${date}T${dusk}Z`)).toBeLessThan(1);
      expect(solarElevationDeg(lat, lon, sun.civilDusk as Date)).toBeCloseTo(
        -6,
        1,
      );
    },
  );

  it('night is the sun more than 6° below the horizon (SERA), sharp at the twilight', () => {
    const dusk = sunTimes(LFRS.lat, LFRS.lon, at('2026-10-16T12:00:00Z'))
      .civilDusk as Date;
    const shifted = (minutes: number) =>
      new Date(dusk.getTime() + minutes * 60000);
    expect(isNight(LFRS.lat, LFRS.lon, shifted(-1))).toBe(false);
    expect(isNight(LFRS.lat, LFRS.lon, shifted(1))).toBe(true);
    expect(isNight(LFRS.lat, LFRS.lon, at('2026-10-16T03:00:00Z'))).toBe(true);
    expect(isNight(LFRS.lat, LFRS.lon, at('2026-10-16T12:00:00Z'))).toBe(false);
  });

  it('works on instants: the end of summer time changes nothing, the solar day follows the longitude', () => {
    // 25 October 2026: the clocks go back at 01:00 UTC. 08:00 CET and
    // 07:00 UTC are the same instant, and so are the results.
    const local = sunTimes(LFRS.lat, LFRS.lon, at('2026-10-25T08:00:00+01:00'));
    const utc = sunTimes(LFRS.lat, LFRS.lon, at('2026-10-25T07:00:00Z'));
    expect(local).toEqual(utc);
    // The day before at 23:30 summer time is 21:30 UTC on the 24th.
    expect(
      sunTimes(LFRS.lat, LFRS.lon, at('2026-10-24T23:30:00+02:00')).date,
    ).toBe('2026-10-24');
    // 00:30 UTC is still the evening of the 16th in the far west (local
    // solar time about 13:00 the day before at 170° W).
    expect(sunTimes(48, -170, at('2026-10-17T00:30:00Z')).date).toBe(
      '2026-10-16',
    );
    expect(sunTimes(48, 170, at('2026-10-16T23:30:00Z')).date).toBe(
      '2026-10-17',
    );
  });
});

describe('night flight in the plan', () => {
  it('R5: LFRS -> LFRN at 19:00Z entered "VFR by day" gets the night reserve, with the times', () => {
    const plan = computeFlightPlan(
      engineInput({ departureTime: at('2026-10-16T19:00:00Z') }),
    );
    expect(plan.daylight.night).toBe(true);
    expect(plan.daylight.nightFrom).toEqual(at('2026-10-16T19:00:00Z'));
    expect(plan.fuel.reserveCase).toBe('VFR_NIGHT');
    expect(plan.fuel.finalReserveMin).toBe(45);
    expect(plan.fuel.finalReserveL).toBeCloseTo(18, 6);
    const notice = plan.notices.find((n) => n.code === 'NIGHT_FLIGHT');
    expect(notice).toMatchObject({
      status: 'WARNING',
      message: {
        key: 'navplan.notice.nightReserveImposed',
        params: { time: '16/10 19:00 UTC' },
      },
    });
    const [departure, destination] = plan.daylight.aerodromes;
    expect(departure).toMatchObject({ icao: 'LFRS', role: 'departure' });
    expect(destination).toMatchObject({ icao: 'LFRN', role: 'destination' });
    expect(
      minutesBetween(departure.civilDusk, '2026-10-16T17:48:32Z'),
    ).toBeLessThan(1);
  });

  it('a flight chosen "VFR by night" keeps its reserve and is told it is at night', () => {
    const plan = computeFlightPlan(
      engineInput({
        departureTime: at('2026-10-16T03:00:00Z'),
        reserveCase: 'VFR_NIGHT',
      }),
    );
    expect(plan.fuel.finalReserveMin).toBe(45);
    expect(
      plan.notices.find((n) => n.code === 'NIGHT_FLIGHT')?.message.key,
    ).toBe('navplan.notice.nightFlight');
  });

  it('a day flight keeps the day reserve, with no night notice', () => {
    const plan = computeFlightPlan(engineInput());
    expect(plan.daylight.night).toBe(false);
    expect(plan.fuel.reserveCase).toBe('VFR_DAY');
    expect(plan.fuel.finalReserveMin).toBe(30);
    expect(plan.notices.filter((n) => n.code.startsWith('NIGHT'))).toEqual([]);
  });

  it('an off-block before the morning civil twilight is a night flight, even if it lands by day', () => {
    // LFRS, 16/10: civil twilight begins about 05:55Z.
    const plan = computeFlightPlan(
      engineInput({ departureTime: at('2026-10-16T05:45:00Z') }),
    );
    expect(plan.daylight.night).toBe(true);
    expect(plan.fuel.finalReserveMin).toBe(45);
  });

  it('a night arrival at the alternate makes the flight a night flight', () => {
    const base = computeFlightPlan(
      engineInput({
        alternate: LFRD,
        departureTime: at('2026-10-16T12:00:00Z'),
      }),
    );
    const dusk = sunTimes(LFRD.lat, LFRD.lon, at('2026-10-16T12:00:00Z'))
      .civilDusk as Date;
    const landingAtDestination =
      10 + base.totalTimeMin + CIRCUIT_AND_LANDING_MIN;
    const toAlternate =
      10 +
      (base.alternateLeg?.cumulativeTimeMin ?? 0) +
      CIRCUIT_AND_LANDING_MIN;
    // Destination reached by day, the alternate after the twilight.
    const departure = new Date(
      dusk.getTime() - ((landingAtDestination + toAlternate) / 2) * 60000,
    );
    const plan = computeFlightPlan(
      engineInput({ alternate: LFRD, departureTime: departure }),
    );
    expect(plan.daylight.night).toBe(true);
    expect(plan.fuel.finalReserveMin).toBe(45);
    expect(plan.daylight.aerodromes.map((a) => a.role)).toEqual([
      'departure',
      'destination',
      'alternate',
    ]);
  });

  it('warns when the landing is less than 30 min before the end of civil twilight', () => {
    const day = computeFlightPlan(engineInput());
    const dusk = sunTimes(LFRN.lat, LFRN.lon, at('2026-10-16T12:00:00Z'))
      .civilDusk as Date;
    const flight = 10 + day.totalTimeMin + CIRCUIT_AND_LANDING_MIN;
    const departing = (minutesBeforeDusk: number) =>
      computeFlightPlan(
        engineInput({
          departureTime: new Date(
            dusk.getTime() - (flight + minutesBeforeDusk) * 60000,
          ),
        }),
      );
    const close = departing(15);
    expect(close.daylight.night).toBe(false);
    expect(close.fuel.finalReserveMin).toBe(30);
    expect(
      close.notices.find((n) => n.code === 'NIGHT_APPROACHING'),
    ).toMatchObject({
      status: 'WARNING',
      message: {
        key: 'navplan.notice.nightApproaching',
        params: { icao: 'LFRN', role: 'destination', minutes: 15 },
      },
    });
    const early = departing(NIGHT_MARGIN_MIN + 5);
    expect(early.notices.some((n) => n.code === 'NIGHT_APPROACHING')).toBe(
      false,
    );
    const late = departing(-5);
    expect(late.daylight.night).toBe(true);
    expect(late.fuel.finalReserveMin).toBe(45);
  });
});

describe('weather checked against the planned times', () => {
  it('reads the validity of a raw TAF, across the end of a month', () => {
    expect(
      tafValidity(
        'TAF LFPN 161400Z 1615/1624 28008KT 9999 BKN020',
        at('2026-10-16T18:00:00Z'),
      ),
    ).toEqual({
      from: at('2026-10-16T15:00:00Z'),
      to: at('2026-10-17T00:00:00Z'),
    });
    expect(
      tafValidity(
        'TAF AMD LFRS 302300Z 3100/0106 CAVOK',
        at('2026-10-31T01:00:00Z'),
      ),
    ).toEqual({
      from: at('2026-10-31T00:00:00Z'),
      to: at('2026-11-01T06:00:00Z'),
    });
    expect(tafValidity('TAF LFRS NIL', at('2026-10-16T18:00:00Z'))).toBeNull();
  });

  const codes = (plan: ReturnType<typeof computeFlightPlan>) =>
    plan.notices.map((n) => n.code);

  it('R1 the next morning: old METAR for the QNH, TAFs ending before the flight, winds out of range', () => {
    const windTo = at('2026-10-17T06:00:00Z');
    const wind = (_lat: number, _lon: number, _alt: number, time: Date) =>
      time.getTime() > windTo.getTime()
        ? null
        : ({
            fromDeg: 20,
            speedKt: 20,
            temperatureC: 5,
            validAt: time,
          } as WindForecast);
    const plan = computeFlightPlan(
      engineInput({
        departureTime: at('2026-10-17T08:00:00Z'),
        qnhHpa: 1023,
        qnhSource: 'METAR',
        qnhStation: 'LFRS',
        qnhObservedAt: at('2026-10-16T17:30:00Z'),
        wind,
        windCoverage: {
          run: '2026-10-16 12Z',
          from: at('2026-10-16T12:00:00Z'),
          to: windTo,
        },
        weather: [
          {
            icao: 'LFRS',
            metar: 'METAR LFRS 161730Z AUTO 03005KT 9999 Q1023',
            taf: 'TAF LFRS 161400Z 1615/1624 36009KT 9999',
            observedAt: at('2026-10-16T17:30:00Z'),
            tafValidFrom: at('2026-10-16T15:00:00Z'),
            tafValidTo: at('2026-10-17T00:00:00Z'),
          },
          {
            icao: 'LFRN',
            metar: 'METAR LFRN 161730Z AUTO 35010KT CAVOK Q1026',
            taf: 'TAF LFRN 161400Z 1615/1624 36012KT 9999',
            observedAt: at('2026-10-16T17:30:00Z'),
            tafValidFrom: at('2026-10-16T15:00:00Z'),
            tafValidTo: at('2026-10-17T00:00:00Z'),
          },
        ],
      }),
    );
    const qnh = plan.notices.find((n) => n.code === 'QNH_METAR_OLD');
    expect(qnh?.message).toEqual({
      key: 'navplan.notice.qnhMetarOld',
      params: { icao: 'LFRS', time: '16/10 17:30 UTC' },
    });
    expect(
      plan.notices
        .filter((n) => n.code === 'TAF_NOT_COVERING')
        .map((n) => n.message.params?.icao),
    ).toEqual(['LFRS', 'LFRN']);
    expect(codes(plan)).toContain('WIND_OUT_OF_RANGE');
    // Not said twice: the range notice replaces the generic one.
    expect(codes(plan)).not.toContain('WIND_UNAVAILABLE');
    expect(plan.legs[0].wind).toMatchObject({ source: 'NONE', speedKt: 0 });
    expect(plan).toMatchObject({
      qnhSource: 'METAR',
      qnhStation: 'LFRS',
      qnhObservedAt: at('2026-10-16T17:30:00Z'),
    });
    expect(plan.status).toBe('BLOCKING'); // mass and balance not confirmed
  });

  it('the same plan computed on the morning is quiet about the weather', () => {
    const plan = computeFlightPlan(
      engineInput({
        departureTime: at('2026-10-17T08:00:00Z'),
        qnhHpa: 1023,
        qnhSource: 'METAR',
        qnhStation: 'LFRS',
        qnhObservedAt: at('2026-10-17T07:30:00Z'),
        weather: ['LFRS', 'LFRN'].map((icao) => ({
          icao,
          metar: `METAR ${icao} 170730Z CAVOK Q1023`,
          taf: `TAF ${icao} 170500Z 1706/1715 CAVOK`,
          observedAt: at('2026-10-17T07:30:00Z'),
          tafValidFrom: at('2026-10-17T06:00:00Z'),
          tafValidTo: at('2026-10-17T15:00:00Z'),
        })),
      }),
    );
    expect(
      codes(plan).filter((c) => /QNH|TAF|FORECAST|WIND_OUT/.test(c)),
    ).toEqual([]);
  });

  it('says when an aerodrome has no TAF, or none readable', () => {
    const plan = computeFlightPlan(
      engineInput({
        departureTime: at('2026-10-17T08:00:00Z'),
        alternate: LFRD,
        weather: [
          {
            icao: 'LFRS',
            metar: 'METAR LFRS 161730Z CAVOK Q1023',
            taf: null,
            observedAt: at('2026-10-16T17:30:00Z'),
          },
          {
            icao: 'LFRN',
            metar: null,
            taf: 'TAF LFRN NIL',
            observedAt: null,
          },
        ],
      }),
    );
    const byCode = (code: string) =>
      plan.notices
        .filter((n) => n.code === code)
        .map((n) => n.message.params?.icao);
    expect(byCode('DEPARTURE_NO_FORECAST')).toEqual(['LFRS']);
    expect(byCode('TAF_NOT_COVERING')).toEqual(['LFRN']);
    expect(byCode('TAF_MISSING')).toEqual(['LFRD']);
  });

  it('writes UTC times with the date when it is not the reference day', () => {
    expect(
      utcTime(at('2026-10-16T17:30:00Z'), at('2026-10-17T08:00:00Z')),
    ).toBe('16/10 17:30 UTC');
    expect(
      utcTime(at('2026-10-17T07:30:00Z'), at('2026-10-17T08:00:00Z')),
    ).toBe('07:30 UTC');
  });
});
