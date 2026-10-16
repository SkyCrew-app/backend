import { WMM2025_COF } from './wmm2025.cof';

// World Magnetic Model 2025 (NOAA/NCEI, public domain): spherical harmonic
// expansion to degree 12 with secular variation, as described in the
// WMM2025 technical report. Inputs are geodetic (WGS84) latitude and
// longitude in degrees, height above the ellipsoid in km and a decimal year.

const MAX_DEGREE = 12;
const EARTH_RADIUS_KM = 6371.2; // geomagnetic reference radius
const WGS84_A_KM = 6378.137;
const WGS84_B_KM = 6356.752314245;
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export const WMM_EPOCH = 2025.0;
export const WMM_VALID_UNTIL = 2030.0;

export class WmmExpiredError extends Error {
  readonly code = 'WMM_EXPIRED';
}

interface Coefficients {
  g: number[][];
  h: number[][];
  gDot: number[][];
  hDot: number[][];
}

const square = () =>
  Array.from({ length: MAX_DEGREE + 1 }, () =>
    new Array<number>(MAX_DEGREE + 1).fill(0),
  );

const parseCoefficients = (text: string): Coefficients => {
  const coefficients = {
    g: square(),
    h: square(),
    gDot: square(),
    hDot: square(),
  };
  for (const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 6 || /^9{6,}/.test(parts[0])) continue;
    const [n, m, g, h, gDot, hDot] = parts.map(Number);
    if (!Number.isInteger(n) || n < 1 || n > MAX_DEGREE) continue;
    coefficients.g[n][m] = g;
    coefficients.h[n][m] = h;
    coefficients.gDot[n][m] = gDot;
    coefficients.hDot[n][m] = hDot;
  }
  return coefficients;
};

const COEFFICIENTS = parseCoefficients(WMM2025_COF);

// Factors turning Gauss-normalised associated Legendre functions into
// Schmidt semi-normalised ones.
const SCHMIDT = (() => {
  const s = square();
  s[0][0] = 1;
  for (let n = 1; n <= MAX_DEGREE; n++) {
    s[n][0] = (s[n - 1][0] * (2 * n - 1)) / n;
    for (let m = 1; m <= n; m++) {
      s[n][m] =
        s[n][m - 1] * Math.sqrt(((n - m + 1) * (m === 1 ? 2 : 1)) / (n + m));
    }
  }
  return s;
})();

export interface MagneticField {
  declinationDeg: number; // east positive
  inclinationDeg: number;
  h: number; // nT
  x: number;
  y: number;
  z: number;
  f: number;
}

export const decimalYear = (date: Date): number => {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return year + (date.getTime() - start) / (end - start);
};

export function magneticField(
  latDeg: number,
  lonDeg: number,
  heightKm: number,
  year: number,
): MagneticField {
  if (year < WMM_EPOCH || year >= WMM_VALID_UNTIL) {
    throw new WmmExpiredError(
      `WMM2025 is valid from ${WMM_EPOCH} to ${WMM_VALID_UNTIL}, not ${year.toFixed(2)}`,
    );
  }
  const dt = year - WMM_EPOCH;

  // Geodetic to geocentric spherical coordinates.
  const lat = latDeg * RAD;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const a2 = WGS84_A_KM * WGS84_A_KM;
  const b2 = WGS84_B_KM * WGS84_B_KM;
  const e2 = 1 - b2 / a2;
  const rc = WGS84_A_KM / Math.sqrt(1 - e2 * sinLat * sinLat);
  const xp = (rc + heightKm) * cosLat;
  const zp = (rc * (1 - e2) + heightKm) * sinLat;
  const r = Math.sqrt(xp * xp + zp * zp);
  const latGeocentric = Math.asin(zp / r);

  // Colatitude theta: cos(theta) = sin(geocentric latitude).
  const cosTheta = Math.sin(latGeocentric);
  const sinTheta = Math.cos(latGeocentric);
  const lon = lonDeg * RAD;

  const p = square();
  const dp = square();
  p[0][0] = 1;
  dp[0][0] = 0;
  for (let n = 1; n <= MAX_DEGREE; n++) {
    for (let m = 0; m <= n; m++) {
      if (n === m) {
        p[n][m] = sinTheta * p[n - 1][m - 1];
        dp[n][m] = sinTheta * dp[n - 1][m - 1] + cosTheta * p[n - 1][m - 1];
      } else if (n === 1 && m === 0) {
        p[n][m] = cosTheta * p[n - 1][m];
        dp[n][m] = cosTheta * dp[n - 1][m] - sinTheta * p[n - 1][m];
      } else {
        const k = ((n - 1) * (n - 1) - m * m) / ((2 * n - 1) * (2 * n - 3));
        const p2 = n - 2 >= m ? p[n - 2][m] : 0;
        const dp2 = n - 2 >= m ? dp[n - 2][m] : 0;
        p[n][m] = cosTheta * p[n - 1][m] - k * p2;
        dp[n][m] = cosTheta * dp[n - 1][m] - sinTheta * p[n - 1][m] - k * dp2;
      }
    }
  }

  let br = 0;
  let bt = 0;
  let bp = 0;
  const ratio = EARTH_RADIUS_KM / r;
  let power = ratio * ratio; // (a/r)^(n+2) starts at n = 1 with (a/r)^3
  for (let n = 1; n <= MAX_DEGREE; n++) {
    power *= ratio;
    for (let m = 0; m <= n; m++) {
      const g =
        (COEFFICIENTS.g[n][m] + dt * COEFFICIENTS.gDot[n][m]) * SCHMIDT[n][m];
      const h =
        (COEFFICIENTS.h[n][m] + dt * COEFFICIENTS.hDot[n][m]) * SCHMIDT[n][m];
      const cosM = Math.cos(m * lon);
      const sinM = Math.sin(m * lon);
      const term = g * cosM + h * sinM;
      br += (n + 1) * power * term * p[n][m];
      bt -= power * term * dp[n][m];
      bp += power * m * (g * sinM - h * cosM) * p[n][m];
    }
  }
  // At the poles sin(theta) is 0; the WMM report's limit is not needed for
  // aviation latitudes.
  bp = sinTheta === 0 ? 0 : bp / sinTheta;

  // Geocentric (north, east, down) then rotated to geodetic axes.
  const xGeocentric = -bt;
  const yGeocentric = bp;
  const zGeocentric = -br;
  const psi = latGeocentric - lat;
  const x = xGeocentric * Math.cos(psi) - zGeocentric * Math.sin(psi);
  const z = xGeocentric * Math.sin(psi) + zGeocentric * Math.cos(psi);
  const y = yGeocentric;

  const h = Math.sqrt(x * x + y * y);
  return {
    declinationDeg: Math.atan2(y, x) * DEG,
    inclinationDeg: Math.atan2(z, h) * DEG,
    h,
    x,
    y,
    z,
    f: Math.sqrt(h * h + z * z),
  };
}

// Magnetic variation (declination) at a point on a date, east positive.
// Aircraft altitudes change it by less than 0.01 degree: computed at the
// height of the ellipsoid.
export const declinationAt = (
  latDeg: number,
  lonDeg: number,
  date: Date,
): number => magneticField(latDeg, lonDeg, 0, decimalYear(date)).declinationDeg;
