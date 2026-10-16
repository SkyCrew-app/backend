// Geodesics on the WGS84 ellipsoid (Vincenty's inverse and direct formulae,
// iterated to 1e-12 rad). For the distances of a VFR flight they agree with
// GeographicLib (Karney) to well under a millimetre; they would converge
// slowly only for nearly antipodal points, which a light aircraft never
// joins in one leg (such a leg is refused rather than approximated).
//
// Units at this boundary: degrees, metres and nautical miles (1 NM = 1852 m).

export const WGS84_A = 6378137;
export const WGS84_F = 1 / 298.257223563;
const WGS84_B = WGS84_A * (1 - WGS84_F);
export const METRES_PER_NM = 1852;

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export interface LatLon {
  lat: number;
  lon: number;
}

export interface InverseResult {
  distanceM: number;
  distanceNm: number;
  // Forward azimuth at the start and at the end, degrees from true north,
  // in [0, 360).
  initialCourseDeg: number;
  finalCourseDeg: number;
}

export const normalizeDeg = (deg: number): number => {
  const value = deg % 360;
  return value < 0 ? value + 360 : value;
};

const normalizeLon = (lon: number): number => {
  let value = ((lon + 180) % 360) - 180;
  if (value < -180) value += 360;
  return value;
};

export class GeodesyError extends Error {}

export function inverse(from: LatLon, to: LatLon): InverseResult {
  const f = WGS84_F;
  const L = (to.lon - from.lon) * RAD;
  const U1 = Math.atan((1 - f) * Math.tan(from.lat * RAD));
  const U2 = Math.atan((1 - f) * Math.tan(to.lat * RAD));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);

  let lambda = L;
  let sinSigma = 0;
  let cosSigma = 1;
  let sigma = 0;
  let cosSqAlpha = 1;
  let cos2SigmaM = 0;
  let sinLambda = 0;
  let cosLambda = 1;
  let iterations = 0;
  let previous: number;
  do {
    sinLambda = Math.sin(lambda);
    cosLambda = Math.cos(lambda);
    const a = cosU2 * sinLambda;
    const b = cosU1 * sinU2 - sinU1 * cosU2 * cosLambda;
    sinSigma = Math.sqrt(a * a + b * b);
    if (sinSigma === 0) {
      return {
        distanceM: 0,
        distanceNm: 0,
        initialCourseDeg: 0,
        finalCourseDeg: 0,
      };
    }
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM =
      cosSqAlpha !== 0 ? cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha : 0;
    const C = (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    previous = lambda;
    lambda =
      L +
      (1 - C) *
        f *
        sinAlpha *
        (sigma +
          C *
            sinSigma *
            (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
    iterations += 1;
    if (iterations > 1000) {
      throw new GeodesyError('Geodesic did not converge (antipodal points)');
    }
  } while (Math.abs(lambda - previous) > 1e-12);

  const uSq =
    (cosSqAlpha * (WGS84_A * WGS84_A - WGS84_B * WGS84_B)) /
    (WGS84_B * WGS84_B);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma =
    B *
    sinSigma *
    (cos2SigmaM +
      (B / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
          (B / 6) *
            cos2SigmaM *
            (-3 + 4 * sinSigma * sinSigma) *
            (-3 + 4 * cos2SigmaM * cos2SigmaM)));
  const distanceM = WGS84_B * A * (sigma - deltaSigma);

  const alpha1 = Math.atan2(
    cosU2 * sinLambda,
    cosU1 * sinU2 - sinU1 * cosU2 * cosLambda,
  );
  const alpha2 = Math.atan2(
    cosU1 * sinLambda,
    -sinU1 * cosU2 + cosU1 * sinU2 * cosLambda,
  );
  return {
    distanceM,
    distanceNm: distanceM / METRES_PER_NM,
    initialCourseDeg: normalizeDeg(alpha1 * DEG),
    finalCourseDeg: normalizeDeg(alpha2 * DEG),
  };
}

export interface DirectResult extends LatLon {
  finalCourseDeg: number;
}

export function direct(
  from: LatLon,
  courseDeg: number,
  distanceM: number,
): DirectResult {
  const f = WGS84_F;
  const alpha1 = courseDeg * RAD;
  const sinAlpha1 = Math.sin(alpha1);
  const cosAlpha1 = Math.cos(alpha1);
  const tanU1 = (1 - f) * Math.tan(from.lat * RAD);
  const cosU1 = 1 / Math.sqrt(1 + tanU1 * tanU1);
  const sinU1 = tanU1 * cosU1;
  const sigma1 = Math.atan2(tanU1, cosAlpha1);
  const sinAlpha = cosU1 * sinAlpha1;
  const cosSqAlpha = 1 - sinAlpha * sinAlpha;
  const uSq =
    (cosSqAlpha * (WGS84_A * WGS84_A - WGS84_B * WGS84_B)) /
    (WGS84_B * WGS84_B);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));

  let sigma = distanceM / (WGS84_B * A);
  let previous: number;
  let cos2SigmaM = 0;
  let sinSigma = 0;
  let cosSigma = 1;
  let iterations = 0;
  do {
    cos2SigmaM = Math.cos(2 * sigma1 + sigma);
    sinSigma = Math.sin(sigma);
    cosSigma = Math.cos(sigma);
    const deltaSigma =
      B *
      sinSigma *
      (cos2SigmaM +
        (B / 4) *
          (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
            (B / 6) *
              cos2SigmaM *
              (-3 + 4 * sinSigma * sinSigma) *
              (-3 + 4 * cos2SigmaM * cos2SigmaM)));
    previous = sigma;
    sigma = distanceM / (WGS84_B * A) + deltaSigma;
    iterations += 1;
    if (iterations > 1000) {
      throw new GeodesyError('Geodesic did not converge');
    }
  } while (Math.abs(sigma - previous) > 1e-12);
  cos2SigmaM = Math.cos(2 * sigma1 + sigma);
  sinSigma = Math.sin(sigma);
  cosSigma = Math.cos(sigma);

  const tmp = sinU1 * sinSigma - cosU1 * cosSigma * cosAlpha1;
  const lat2 = Math.atan2(
    sinU1 * cosSigma + cosU1 * sinSigma * cosAlpha1,
    (1 - f) * Math.sqrt(sinAlpha * sinAlpha + tmp * tmp),
  );
  const lambda = Math.atan2(
    sinSigma * sinAlpha1,
    cosU1 * cosSigma - sinU1 * sinSigma * cosAlpha1,
  );
  const C = (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
  const L =
    lambda -
    (1 - C) *
      f *
      sinAlpha *
      (sigma +
        C *
          sinSigma *
          (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
  const alpha2 = Math.atan2(sinAlpha, -tmp);
  return {
    lat: lat2 * DEG,
    lon: normalizeLon(from.lon + L * DEG),
    finalCourseDeg: normalizeDeg(alpha2 * DEG),
  };
}

// The point at `distanceNm` from `from` on the geodesic towards `to`.
export function pointAlong(
  from: LatLon,
  to: LatLon,
  distanceNm: number,
): LatLon {
  const { initialCourseDeg } = inverse(from, to);
  const point = direct(from, initialCourseDeg, distanceNm * METRES_PER_NM);
  return { lat: point.lat, lon: point.lon };
}

export interface LegGeometry {
  distanceNm: number;
  initialCourseDeg: number;
  finalCourseDeg: number;
  // True course at the middle of the leg: what the navigation log shows.
  midCourseDeg: number;
  midpoint: LatLon;
}

export function legGeometry(from: LatLon, to: LatLon): LegGeometry {
  const leg = inverse(from, to);
  if (leg.distanceM === 0) {
    return {
      distanceNm: 0,
      initialCourseDeg: 0,
      finalCourseDeg: 0,
      midCourseDeg: 0,
      midpoint: { ...from },
    };
  }
  const mid = direct(from, leg.initialCourseDeg, leg.distanceM / 2);
  return {
    distanceNm: leg.distanceNm,
    initialCourseDeg: leg.initialCourseDeg,
    finalCourseDeg: leg.finalCourseDeg,
    midCourseDeg: mid.finalCourseDeg,
    midpoint: { lat: mid.lat, lon: mid.lon },
  };
}
