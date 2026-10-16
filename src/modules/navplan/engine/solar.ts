// Sun position, sunrise / sunset and civil twilight: the NOAA solar
// calculator algorithm (NOAA Global Monitoring Laboratory, "General Solar
// Position Calculations" and the NOAA_Solar_Calculations spreadsheet, after
// Jean Meeus, Astronomical Algorithms). Accuracy about one minute at the
// latitudes of Europe. All times are UTC instants.
//
// Night, for aviation: Regulation (EU) No 923/2012 (SERA), Article 2(97),
// repeated in Annex I to Regulation (EU) No 965/2012 (Air OPS): "the hours
// between the end of evening civil twilight and the beginning of morning
// civil twilight. Civil twilight ends in the evening when the centre of the
// sun's disc is 6 degrees below the horizon and begins in the morning when
// the centre of the sun's disc is 6 degrees below the horizon".

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;

// Sunrise / sunset: upper limb on the horizon with the standard refraction
// (0.833°). Civil twilight: centre of the disc 6° below the horizon, the
// geometric position (SERA does not correct it for refraction).
export const SUNRISE_ELEVATION_DEG = -0.833;
export const CIVIL_TWILIGHT_ELEVATION_DEG = -6;

interface SunState {
  declinationRad: number;
  equationOfTimeMin: number;
}

function sunState(time: Date): SunState {
  const julianDay = time.getTime() / DAY_MS + 2440587.5;
  const t = (julianDay - 2451545) / 36525;
  const meanLongitude =
    (((280.46646 + t * (36000.76983 + t * 0.0003032)) % 360) + 360) % 360;
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const centre =
    Math.sin(meanAnomaly * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * meanAnomaly * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * meanAnomaly * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const apparentLongitude =
    meanLongitude + centre - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const meanObliquity =
    23 +
    (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * Math.cos(omega * RAD);
  const declinationRad = Math.asin(
    Math.sin(obliquity * RAD) * Math.sin(apparentLongitude * RAD),
  );
  const y = Math.tan((obliquity / 2) * RAD) ** 2;
  const l0 = meanLongitude * RAD;
  const m = meanAnomaly * RAD;
  const equationOfTimeMin =
    (4 / RAD) *
    (y * Math.sin(2 * l0) -
      2 * eccentricity * Math.sin(m) +
      4 * eccentricity * y * Math.sin(m) * Math.cos(2 * l0) -
      0.5 * y * y * Math.sin(4 * l0) -
      1.25 * eccentricity * eccentricity * Math.sin(2 * m));
  return { declinationRad, equationOfTimeMin };
}

/** Geometric elevation of the centre of the sun, in degrees (east longitude positive). */
export function solarElevationDeg(
  lat: number,
  lon: number,
  time: Date,
): number {
  const { declinationRad, equationOfTimeMin } = sunState(time);
  const minutes =
    (((time.getTime() % DAY_MS) + DAY_MS) % DAY_MS) / 60000 +
    equationOfTimeMin +
    4 * lon;
  const hourAngle = (minutes / 4 - 180) * RAD;
  const cosZenith =
    Math.sin(lat * RAD) * Math.sin(declinationRad) +
    Math.cos(lat * RAD) * Math.cos(declinationRad) * Math.cos(hourAngle);
  return 90 - Math.acos(Math.max(-1, Math.min(1, cosZenith))) / RAD;
}

/**
 * True when the instant is in the aviation night at that place (SERA): the
 * centre of the sun more than 6° below the horizon.
 */
export const isNight = (lat: number, lon: number, time: Date): boolean =>
  solarElevationDeg(lat, lon, time) < CIVIL_TWILIGHT_ELEVATION_DEG;

// Time of the morning (-1) or evening (+1) crossing of `elevationDeg` on the
// solar day around `noonGuess`; null when the sun stays above or below it.
function crossing(
  lat: number,
  lon: number,
  noonGuess: Date,
  elevationDeg: number,
  side: -1 | 1,
): Date | null {
  let estimate = noonGuess;
  for (let i = 0; i < 3; i++) {
    const { declinationRad, equationOfTimeMin } = sunState(estimate);
    const cosHourAngle =
      (Math.sin(elevationDeg * RAD) -
        Math.sin(lat * RAD) * Math.sin(declinationRad)) /
      (Math.cos(lat * RAD) * Math.cos(declinationRad));
    if (cosHourAngle < -1 || cosHourAngle > 1) return null;
    const hourAngleDeg = Math.acos(cosHourAngle) / RAD;
    const dayStart = Math.floor(noonGuess.getTime() / DAY_MS) * DAY_MS;
    const noonMin = 720 - 4 * lon - equationOfTimeMin;
    const eventMin = noonMin + side * 4 * hourAngleDeg;
    estimate = new Date(dayStart + Math.round(eventMin * 60000));
  }
  return estimate;
}

export interface SunTimes {
  /** The UTC date of the local solar day, YYYY-MM-DD. */
  date: string;
  civilDawn: Date | null;
  sunrise: Date | null;
  sunset: Date | null;
  civilDusk: Date | null;
}

/**
 * Twilight, sunrise and sunset of the solar day that contains `time` at that
 * place (the day runs from local solar midnight to local solar midnight, so
 * that a time just after 00:00 UTC in the far west stays on its own evening).
 */
export function sunTimes(lat: number, lon: number, time: Date): SunTimes {
  const localSolarMs = time.getTime() + (lon / 15) * 3_600_000;
  const dayStart = Math.floor(localSolarMs / DAY_MS) * DAY_MS;
  const noonGuess = new Date(dayStart + DAY_MS / 2 - (lon / 15) * 3_600_000);
  return {
    date: new Date(dayStart).toISOString().slice(0, 10),
    civilDawn: crossing(lat, lon, noonGuess, CIVIL_TWILIGHT_ELEVATION_DEG, -1),
    sunrise: crossing(lat, lon, noonGuess, SUNRISE_ELEVATION_DEG, -1),
    sunset: crossing(lat, lon, noonGuess, SUNRISE_ELEVATION_DEG, 1),
    civilDusk: crossing(lat, lon, noonGuess, CIVIL_TWILIGHT_ELEVATION_DEG, 1),
  };
}
