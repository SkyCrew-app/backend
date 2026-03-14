const EARTH_RADIUS_KM = 6371;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;
const toDegrees = (rad: number): number => (rad * 180) / Math.PI;

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function intermediatePoint(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  t: number,
): { lat: number; lon: number } {
  if (t <= 0) return { lat: lat1, lon: lon1 };
  if (t >= 1) return { lat: lat2, lon: lon2 };
  if (lat1 === lat2 && lon1 === lon2) return { lat: lat1, lon: lon1 };

  const φ1 = toRadians(lat1);
  const λ1 = toRadians(lon1);
  const φ2 = toRadians(lat2);
  const λ2 = toRadians(lon2);

  const δ =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((φ2 - φ1) / 2) ** 2 +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
      ),
    );

  if (δ === 0) return { lat: lat1, lon: lon1 };

  const a = Math.sin((1 - t) * δ) / Math.sin(δ);
  const b = Math.sin(t * δ) / Math.sin(δ);

  const x = a * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2);
  const y = a * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2);
  const z = a * Math.sin(φ1) + b * Math.sin(φ2);

  const φ3 = Math.atan2(z, Math.sqrt(x ** 2 + y ** 2));
  const λ3 = Math.atan2(y, x);

  return {
    lat: toDegrees(φ3),
    lon: ((toDegrees(λ3) + 540) % 360) - 180,
  };
}

export function computeBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lon2 - lon1);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return ((toDegrees(Math.atan2(y, x)) % 360) + 360) % 360;
}

export function greatCirclePoints(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  numPoints: number,
): Array<{ lat: number; lon: number }> {
  if (numPoints <= 0) return [];

  const points: Array<{ lat: number; lon: number }> = [];
  for (let i = 1; i <= numPoints; i += 1) {
    const t = i / (numPoints + 1);
    points.push(intermediatePoint(lat1, lon1, lat2, lon2, t));
  }

  return points;
}
