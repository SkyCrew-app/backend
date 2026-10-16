import { LatLon, WGS84_A, WGS84_F, METRES_PER_NM } from './geodesy';

// Planar geometry helpers. Points are [x, y].
export type Point = [number, number];

const EPS = 1e-12;

// Ray casting; a point on an edge or a vertex counts as inside.
export function pointInPolygon(point: Point, ring: Point[]): boolean {
  const [x, y] = point;
  const n = ring.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (onSegment(point, ring[j], ring[i])) return true;
    if (yi > y !== yj > y) {
      const xCross = ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (x < xCross) inside = !inside;
    }
  }
  return inside;
}

export function onSegment(
  p: Point,
  a: Point,
  b: Point,
  tolerance = 1e-9,
): boolean {
  const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (Math.abs(cross) > tolerance * Math.max(1, length)) return false;
  return (
    p[0] >= Math.min(a[0], b[0]) - tolerance &&
    p[0] <= Math.max(a[0], b[0]) + tolerance &&
    p[1] >= Math.min(a[1], b[1]) - tolerance &&
    p[1] <= Math.max(a[1], b[1]) + tolerance
  );
}

// Parameter t along p->q (0..1) where it crosses a->b, or null.
export function segmentIntersection(
  p: Point,
  q: Point,
  a: Point,
  b: Point,
): number | null {
  const rx = q[0] - p[0];
  const ry = q[1] - p[1];
  const sx = b[0] - a[0];
  const sy = b[1] - a[1];
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < EPS) return null; // parallel or collinear
  const t = ((a[0] - p[0]) * sy - (a[1] - p[1]) * sx) / denominator;
  const u = ((a[0] - p[0]) * ry - (a[1] - p[1]) * rx) / denominator;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return Math.min(1, Math.max(0, t));
}

export function signedArea(ring: Point[]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return -area / 2;
}

// No two non-adjacent edges cross. O(n²): envelopes and checks only.
export function isSimplePolygon(ring: Point[]): boolean {
  const n = ring.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a1 = ring[i];
    const a2 = ring[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      const b1 = ring[j];
      const b2 = ring[(j + 1) % n];
      if (segmentIntersection(a1, a2, b1, b2) !== null) return false;
    }
  }
  return Math.abs(signedArea(ring)) > 0;
}

// Local azimuthal equidistant projection on the WGS84 ellipsoid (spherical
// formulas on the local radius of curvature), centred on `origin`, in NM.
// Over ±100 NM its error is a few metres: enough to place the entry and exit
// of an airspace along a leg.
export function localProjection(origin: LatLon): {
  forward: (point: LatLon) => Point;
} {
  const lat0 = (origin.lat * Math.PI) / 180;
  const lon0 = (origin.lon * Math.PI) / 180;
  const e2 = WGS84_F * (2 - WGS84_F);
  const sin0 = Math.sin(lat0);
  // Gaussian mean radius at the origin.
  const radius =
    (WGS84_A * Math.sqrt(1 - e2)) / (1 - e2 * sin0 * sin0) / METRES_PER_NM;
  const cos0 = Math.cos(lat0);
  return {
    forward: ({ lat, lon }) => {
      const phi = (lat * Math.PI) / 180;
      const lambda = (lon * Math.PI) / 180 - lon0;
      const cosC =
        sin0 * Math.sin(phi) + cos0 * Math.cos(phi) * Math.cos(lambda);
      const c = Math.acos(Math.min(1, Math.max(-1, cosC)));
      const k = c < 1e-12 ? 1 : c / Math.sin(c);
      const x = radius * k * Math.cos(phi) * Math.sin(lambda);
      const y =
        radius *
        k *
        (cos0 * Math.sin(phi) - sin0 * Math.cos(phi) * Math.cos(lambda));
      return [x, y];
    },
  };
}
