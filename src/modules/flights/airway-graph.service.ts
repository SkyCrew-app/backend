import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface NavPoint {
  ident: string;
  lat: number;
  lon: number;
  type: 'VOR' | 'NDB' | 'FIX' | 'DME' | 'VORDME' | 'TACAN';
  name?: string;
  freq?: number; // kHz for NDB, MHz×100 for VOR
  range_nm?: number;
}

export interface AirwaySegment {
  airway: string;
  from: string;
  to: string;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  direction: number; // 1=both, 2=fwd only
  flBase: number; // FL base (e.g., 10 = FL010)
  flTop: number; // FL top (e.g., 460 = FL460)
}

export interface GraphEdge {
  to: string;
  distanceNm: number;
  airway: string | null; // null = DCT (direct)
  flBase: number;
  flTop: number;
}

export interface RouteResult {
  waypoints: RouteWaypoint[];
  airways: string[]; // airway name between each pair
  totalDistanceNm: number;
}

export interface RouteWaypoint {
  ident: string;
  lat: number;
  lon: number;
  type: string;
  name?: string;
  airwayIn?: string | null; // airway used to reach this point
}

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

// European bounding box (generous, covers France + neighbors)
const EUR_LAT_MIN = 35;
const EUR_LAT_MAX = 72;
const EUR_LON_MIN = -15;
const EUR_LON_MAX = 35;

// France bounding box (tighter, for initial focus)
const FR_LAT_MIN = 41;
const FR_LAT_MAX = 52;
const FR_LON_MIN = -6;
const FR_LON_MAX = 10;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const NM_PER_RAD = 3440.065;

/* ================================================================== */
/*  Service                                                            */
/* ================================================================== */

@Injectable()
export class AirwayGraphService implements OnModuleInit {
  private readonly logger = new Logger(AirwayGraphService.name);

  /** All navpoints (VOR, NDB, FIX) indexed by ident */
  private points = new Map<string, NavPoint>();

  /** Adjacency list: ident → edges[] */
  private graph = new Map<string, GraphEdge[]>();

  /** Airway segments for route string building */
  private segments: AirwaySegment[] = [];

  /** Stats */
  private stats = { points: 0, navaids: 0, fixes: 0, airways: 0, edges: 0 };

  /* ---------------------------------------------------------------- */
  /*  Init                                                             */
  /* ---------------------------------------------------------------- */

  onModuleInit() {
    this.logger.log('Loading X-Plane navigation data…');
    const t0 = Date.now();

    this.loadNavaids();
    this.loadFixes();
    this.loadAirways();
    this.buildDctEdges();

    this.stats.points = this.points.size;
    this.stats.edges = [...this.graph.values()].reduce((s, e) => s + e.length, 0);

    this.logger.log(
      `Nav data loaded in ${Date.now() - t0}ms — ` +
        `${this.stats.navaids} navaids, ${this.stats.fixes} fixes, ` +
        `${this.stats.airways} airway segments, ${this.stats.edges} graph edges`,
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Parsers                                                          */
  /* ---------------------------------------------------------------- */

  private dataPath(filename: string): string {
    const paths = [
      path.join(__dirname, 'data', 'xplane', filename),
      path.join(process.cwd(), 'src', 'modules', 'flights', 'data', 'xplane', filename),
      path.join(process.cwd(), 'dist', 'modules', 'flights', 'data', 'xplane', filename),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
    throw new Error(`X-Plane data file not found: ${filename}`);
  }

  /**
   * Parse earth_nav.dat — VOR, NDB, DME
   * Format: type lat lon elev freq range bearing ident name
   * Types: 2=NDB, 3=VOR, 12=DME, 13=VOR/DME
   */
  private loadNavaids(): void {
    const raw = fs.readFileSync(this.dataPath('earth_nav.dat'), 'utf-8');
    const lines = raw.split('\n');
    let count = 0;

    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line === '99') continue;

      const parts = line.split(/\s+/);
      const typeCode = parseInt(parts[0], 10);

      // 2=NDB, 3=VOR, 12=DME, 13=VORDME
      if (![2, 3, 12, 13].includes(typeCode)) continue;

      const lat = parseFloat(parts[1]);
      const lon = parseFloat(parts[2]);

      // Filter: European region
      if (lat < EUR_LAT_MIN || lat > EUR_LAT_MAX) continue;
      if (lon < EUR_LON_MIN || lon > EUR_LON_MAX) continue;

      const freq = parseInt(parts[4], 10);
      const range = parseInt(parts[5], 10);
      const ident = parts[7];
      const name = parts.slice(8).join(' ');

      const type: NavPoint['type'] =
        typeCode === 2
          ? 'NDB'
          : typeCode === 12
            ? 'DME'
            : typeCode === 13
              ? 'VORDME'
              : 'VOR';

      // Use ident as key — if duplicate, prefer VOR/VORDME over NDB
      const existing = this.points.get(ident);
      if (existing) {
        const priority = { VOR: 4, VORDME: 3, DME: 2, NDB: 1, FIX: 0, TACAN: 1 };
        if ((priority[type] || 0) <= (priority[existing.type] || 0)) continue;
      }

      this.points.set(ident, { ident, lat, lon, type, name, freq, range_nm: range });
      count++;
    }

    this.stats.navaids = count;
    this.logger.log(`Loaded ${count} navaids (VOR/NDB/DME) in European region`);
  }

  /**
   * Parse earth_fix.dat — named intersections / waypoints
   * Format: lat lon ident
   */
  private loadFixes(): void {
    const raw = fs.readFileSync(this.dataPath('earth_fix.dat'), 'utf-8');
    const lines = raw.split('\n');
    let count = 0;

    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line === '99') continue;

      const parts = line.split(/\s+/);
      if (parts.length < 3) continue;

      const lat = parseFloat(parts[0]);
      const lon = parseFloat(parts[1]);
      const ident = parts[2];

      // Filter: European region
      if (lat < EUR_LAT_MIN || lat > EUR_LAT_MAX) continue;
      if (lon < EUR_LON_MIN || lon > EUR_LON_MAX) continue;

      // Don't overwrite navaids (VOR/NDB have priority)
      if (this.points.has(ident)) continue;

      this.points.set(ident, { ident, lat, lon, type: 'FIX' });
      count++;
    }

    this.stats.fixes = count;
    this.logger.log(`Loaded ${count} fixes in European region`);
  }

  /**
   * Parse earth_awy.dat — airway segments
   * Format: fix1 lat1 lon1 fix2 lat2 lon2 direction flBase flTop airway
   */
  private loadAirways(): void {
    const raw = fs.readFileSync(this.dataPath('earth_awy.dat'), 'utf-8');
    const lines = raw.split('\n');
    let count = 0;

    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line === '99') continue;

      const parts = line.split(/\s+/);
      if (parts.length < 10) continue;

      const from = parts[0];
      const fromLat = parseFloat(parts[1]);
      const fromLon = parseFloat(parts[2]);
      const to = parts[3];
      const toLat = parseFloat(parts[4]);
      const toLon = parseFloat(parts[5]);
      const direction = parseInt(parts[6], 10);
      const flBase = parseInt(parts[7], 10);
      const flTop = parseInt(parts[8], 10);
      const airway = parts[9];

      // Filter: at least one endpoint in European region
      const fromInEur =
        fromLat >= EUR_LAT_MIN &&
        fromLat <= EUR_LAT_MAX &&
        fromLon >= EUR_LON_MIN &&
        fromLon <= EUR_LON_MAX;
      const toInEur =
        toLat >= EUR_LAT_MIN &&
        toLat <= EUR_LAT_MAX &&
        toLon >= EUR_LON_MIN &&
        toLon <= EUR_LON_MAX;
      if (!fromInEur && !toInEur) continue;

      // Ensure both endpoints exist in points map
      if (!this.points.has(from)) {
        this.points.set(from, { ident: from, lat: fromLat, lon: fromLon, type: 'FIX' });
      }
      if (!this.points.has(to)) {
        this.points.set(to, { ident: to, lat: toLat, lon: toLon, type: 'FIX' });
      }

      const dist = this.haversineNm(fromLat, fromLon, toLat, toLon);

      const seg: AirwaySegment = {
        airway,
        from,
        to,
        fromLat,
        fromLon,
        toLat,
        toLon,
        direction,
        flBase,
        flTop,
      };
      this.segments.push(seg);

      // Add edges (bidirectional by default, direction=2 means forward only)
      const edge: GraphEdge = {
        to,
        distanceNm: dist,
        airway,
        flBase,
        flTop,
      };

      if (!this.graph.has(from)) this.graph.set(from, []);
      this.graph.get(from)!.push(edge);

      if (direction === 1) {
        // Bidirectional
        if (!this.graph.has(to)) this.graph.set(to, []);
        this.graph.get(to)!.push({
          to: from,
          distanceNm: dist,
          airway,
          flBase,
          flTop,
        });
      }

      count++;
    }

    this.stats.airways = count;
    this.logger.log(`Loaded ${count} airway segments in European region`);
  }

  /**
   * Add DCT (direct) edges between navaids that are close enough.
   * This allows VFR routing between VOR/NDB without airways.
   * Only connects VOR/NDB/VORDME within 80 NM of each other.
   */
  private buildDctEdges(): void {
    const navaids: NavPoint[] = [];
    for (const p of this.points.values()) {
      if (['VOR', 'NDB', 'VORDME', 'DME'].includes(p.type)) {
        navaids.push(p);
      }
    }

    let dctCount = 0;
    const maxDctNm = 80;

    for (let i = 0; i < navaids.length; i++) {
      for (let j = i + 1; j < navaids.length; j++) {
        const a = navaids[i];
        const b = navaids[j];

        // Quick lat/lon filter before haversine
        const dLat = Math.abs(a.lat - b.lat);
        const dLon = Math.abs(a.lon - b.lon);
        if (dLat > 2 || dLon > 3) continue;

        const dist = this.haversineNm(a.lat, a.lon, b.lat, b.lon);
        if (dist > maxDctNm) continue;

        // Check if an airway edge already exists
        const existingEdges = this.graph.get(a.ident) || [];
        const hasAirway = existingEdges.some((e) => e.to === b.ident);
        if (hasAirway) continue;

        const edgeAB: GraphEdge = {
          to: b.ident,
          distanceNm: dist,
          airway: null, // DCT
          flBase: 0,
          flTop: 999,
        };
        const edgeBA: GraphEdge = {
          to: a.ident,
          distanceNm: dist,
          airway: null, // DCT
          flBase: 0,
          flTop: 999,
        };

        if (!this.graph.has(a.ident)) this.graph.set(a.ident, []);
        if (!this.graph.has(b.ident)) this.graph.set(b.ident, []);
        this.graph.get(a.ident)!.push(edgeAB);
        this.graph.get(b.ident)!.push(edgeBA);
        dctCount++;
      }
    }

    this.logger.log(`Added ${dctCount} DCT edges between navaids (≤${maxDctNm} NM)`);
  }

  /* ---------------------------------------------------------------- */
  /*  Public API                                                       */
  /* ---------------------------------------------------------------- */

  /** Get a navpoint by ident */
  getPoint(ident: string): NavPoint | undefined {
    return this.points.get(ident);
  }

  /** Find nearest navpoint to a lat/lon, optionally filtered by type */
  findNearest(
    lat: number,
    lon: number,
    maxNm = 30,
    types?: NavPoint['type'][],
  ): NavPoint | null {
    let best: NavPoint | null = null;
    let bestDist = maxNm;

    for (const p of this.points.values()) {
      if (types && !types.includes(p.type)) continue;
      const dist = this.haversineNm(lat, lon, p.lat, p.lon);
      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    }
    return best;
  }

  /** Find all navpoints within radius */
  findWithinRadius(
    lat: number,
    lon: number,
    radiusNm: number,
    types?: NavPoint['type'][],
  ): NavPoint[] {
    const results: NavPoint[] = [];
    for (const p of this.points.values()) {
      if (types && !types.includes(p.type)) continue;
      if (this.haversineNm(lat, lon, p.lat, p.lon) <= radiusNm) {
        results.push(p);
      }
    }
    return results.sort(
      (a, b) =>
        this.haversineNm(lat, lon, a.lat, a.lon) -
        this.haversineNm(lat, lon, b.lat, b.lon),
    );
  }

  /**
   * Find route between two airports using Dijkstra on the airway graph.
   *
   * @param depLat   Departure airport latitude
   * @param depLon   Departure airport longitude
   * @param arrLat   Arrival airport latitude
   * @param arrLon   Arrival airport longitude
   * @param flightLevelHecto  Cruise FL in hundreds of feet (e.g., 95 for FL095)
   * @param isVfr    If true, prefers VOR-to-VOR DCT routes; if false, prefers airways
   */
  findRoute(
    depLat: number,
    depLon: number,
    arrLat: number,
    arrLon: number,
    flightLevelHecto: number,
    isVfr: boolean,
  ): RouteResult | null {
    // 1. Find entry/exit points near airports
    const entryRadius = isVfr ? 40 : 60;
    const exitRadius = isVfr ? 40 : 60;
    const entryTypes: NavPoint['type'][] = isVfr
      ? ['VOR', 'VORDME', 'NDB']
      : ['VOR', 'VORDME', 'FIX', 'NDB'];

    const entryPoints = this.findWithinRadius(depLat, depLon, entryRadius, entryTypes);
    const exitPoints = this.findWithinRadius(arrLat, arrLon, exitRadius, entryTypes);

    if (entryPoints.length === 0 || exitPoints.length === 0) {
      this.logger.warn(
        `No entry/exit points found near airports (dep: ${depLat},${depLon} / arr: ${arrLat},${arrLon})`,
      );
      return null;
    }

    // 2. Try multiple entry/exit combinations (up to 3×3)
    const maxCandidates = 3;
    let bestRoute: RouteResult | null = null;
    let bestCost = Infinity;

    const entries = entryPoints.slice(0, maxCandidates);
    const exits = exitPoints.slice(0, maxCandidates);

    for (const entry of entries) {
      for (const exit of exits) {
        if (entry.ident === exit.ident) continue;

        const result = this.dijkstra(
          entry.ident,
          exit.ident,
          flightLevelHecto,
          isVfr,
          arrLat,
          arrLon,
        );

        if (result && result.totalDistanceNm < bestCost) {
          bestCost = result.totalDistanceNm;
          bestRoute = result;
        }
      }
    }

    return bestRoute;
  }

  /* ---------------------------------------------------------------- */
  /*  Dijkstra                                                         */
  /* ---------------------------------------------------------------- */

  private dijkstra(
    startIdent: string,
    endIdent: string,
    flightLevelHecto: number,
    isVfr: boolean,
    goalLat: number,
    goalLon: number,
  ): RouteResult | null {
    const dist = new Map<string, number>();
    const prev = new Map<string, { ident: string; airway: string | null } | null>();
    const visited = new Set<string>();

    // Priority queue (simple sorted array — sufficient for ~15K nodes)
    const pq: { ident: string; cost: number; heuristic: number }[] = [];

    const startPoint = this.points.get(startIdent);
    const endPoint = this.points.get(endIdent);
    if (!startPoint || !endPoint) return null;

    dist.set(startIdent, 0);
    prev.set(startIdent, null);
    pq.push({
      ident: startIdent,
      cost: 0,
      heuristic: this.haversineNm(startPoint.lat, startPoint.lon, goalLat, goalLon),
    });

    const directDist = this.haversineNm(
      startPoint.lat,
      startPoint.lon,
      endPoint.lat,
      endPoint.lon,
    );
    // Maximum corridor: don't explore nodes too far from the direct route
    const corridorMaxNm = Math.max(directDist * 0.4, 60);

    let iterations = 0;
    const maxIterations = 50000;

    while (pq.length > 0 && iterations < maxIterations) {
      iterations++;

      // Pop cheapest node (A* with heuristic)
      pq.sort((a, b) => a.cost + a.heuristic - (b.cost + b.heuristic));
      const current = pq.shift()!;

      if (current.ident === endIdent) {
        // Reconstruct path
        return this.reconstructPath(prev, endIdent);
      }

      if (visited.has(current.ident)) continue;
      visited.add(current.ident);

      const edges = this.graph.get(current.ident) || [];
      for (const edge of edges) {
        if (visited.has(edge.to)) continue;

        // FL filter: skip edges outside our flight level
        if (flightLevelHecto < edge.flBase || flightLevelHecto > edge.flTop) continue;

        const toPoint = this.points.get(edge.to);
        if (!toPoint) continue;

        // Corridor filter: skip points too far from direct route
        const distFromLine = this.pointToLineDistNm(
          toPoint.lat,
          toPoint.lon,
          startPoint.lat,
          startPoint.lon,
          endPoint.lat,
          endPoint.lon,
        );
        if (distFromLine > corridorMaxNm) continue;

        // Cost calculation
        let cost = edge.distanceNm;

        if (isVfr) {
          // VFR: prefer VOR/NDB (navigable), slight penalty for FIX-only
          if (toPoint.type === 'FIX') cost *= 1.15;
          // Prefer DCT between navaids
          if (edge.airway === null && ['VOR', 'VORDME', 'NDB'].includes(toPoint.type)) {
            cost *= 0.95;
          }
        } else {
          // IFR: prefer airways, penalty for DCT
          if (edge.airway === null) cost *= 1.2;
          // Bonus for VOR-to-VOR along airways
          if (
            edge.airway &&
            ['VOR', 'VORDME'].includes(toPoint.type)
          ) {
            cost *= 0.92;
          }
        }

        const newDist = (dist.get(current.ident) ?? Infinity) + cost;
        if (newDist < (dist.get(edge.to) ?? Infinity)) {
          dist.set(edge.to, newDist);
          prev.set(edge.to, { ident: current.ident, airway: edge.airway });
          pq.push({
            ident: edge.to,
            cost: newDist,
            heuristic: this.haversineNm(toPoint.lat, toPoint.lon, goalLat, goalLon),
          });
        }
      }
    }

    this.logger.warn(
      `Dijkstra: no route found ${startIdent}→${endIdent} after ${iterations} iterations`,
    );
    return null;
  }

  private reconstructPath(
    prev: Map<string, { ident: string; airway: string | null } | null>,
    endIdent: string,
  ): RouteResult {
    const path: RouteWaypoint[] = [];
    const airways: string[] = [];
    let current: string | null = endIdent;
    let totalDist = 0;

    // Rebuild from end to start
    const chain: { ident: string; airway: string | null }[] = [];
    while (current) {
      const entry = prev.get(current);
      chain.push({ ident: current, airway: entry?.airway ?? null });
      current = entry?.ident ?? null;
    }

    chain.reverse();

    for (let i = 0; i < chain.length; i++) {
      const node = chain[i];
      const point = this.points.get(node.ident);
      if (!point) continue;

      const wp: RouteWaypoint = {
        ident: point.ident,
        lat: point.lat,
        lon: point.lon,
        type: point.type,
        name: point.name,
        airwayIn: i > 0 ? chain[i].airway : null,
      };
      path.push(wp);

      if (i > 0) {
        const prevPoint = this.points.get(chain[i - 1].ident);
        if (prevPoint) {
          totalDist += this.haversineNm(
            prevPoint.lat,
            prevPoint.lon,
            point.lat,
            point.lon,
          );
        }
        airways.push(chain[i].airway || 'DCT');
      }
    }

    return { waypoints: path, airways, totalDistanceNm: totalDist };
  }

  /* ---------------------------------------------------------------- */
  /*  Build ICAO route string                                          */
  /* ---------------------------------------------------------------- */

  /**
   * Build an ICAO Field 15-style route string from a RouteResult.
   * Example: "FISTO UL612 VESAN UN869 DIRMO DCT LMG"
   */
  buildRouteString(route: RouteResult): string {
    if (route.waypoints.length === 0) return '';

    const parts: string[] = [route.waypoints[0].ident];
    let lastAirway: string | null = null;

    for (let i = 1; i < route.waypoints.length; i++) {
      const airway = route.airways[i - 1] || 'DCT';

      if (airway !== lastAirway) {
        parts.push(airway);
      }

      // Always add the waypoint after an airway change
      // or if it's the last waypoint of a given airway
      const nextAirway = i < route.airways.length ? route.airways[i] : null;
      if (airway !== nextAirway || i === route.waypoints.length - 1) {
        parts.push(route.waypoints[i].ident);
      }

      lastAirway = airway;
    }

    return parts.join(' ');
  }

  /* ---------------------------------------------------------------- */
  /*  Geo helpers                                                      */
  /* ---------------------------------------------------------------- */

  haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = (lat2 - lat1) * DEG_TO_RAD;
    const dLon = (lon2 - lon1) * DEG_TO_RAD;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * DEG_TO_RAD) *
        Math.cos(lat2 * DEG_TO_RAD) *
        Math.sin(dLon / 2) ** 2;
    return NM_PER_RAD * 2 * Math.asin(Math.sqrt(a));
  }

  /**
   * Approximate perpendicular distance from a point to a great circle line.
   * Used for corridor filtering in Dijkstra.
   */
  private pointToLineDistNm(
    pLat: number,
    pLon: number,
    aLat: number,
    aLon: number,
    bLat: number,
    bLon: number,
  ): number {
    const dAP = this.haversineNm(aLat, aLon, pLat, pLon);
    const dAB = this.haversineNm(aLat, aLon, bLat, bLon);
    const dBP = this.haversineNm(bLat, bLon, pLat, pLon);

    if (dAB === 0) return dAP;

    // Use the cross-track distance formula (simplified)
    // If projection falls outside AB, use endpoint distance
    const along = (dAP ** 2 + dAB ** 2 - dBP ** 2) / (2 * dAB);
    if (along < 0) return dAP;
    if (along > dAB) return dBP;

    return Math.sqrt(Math.max(0, dAP ** 2 - along ** 2));
  }

  bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = (lon2 - lon1) * DEG_TO_RAD;
    const y = Math.sin(dLon) * Math.cos(lat2 * DEG_TO_RAD);
    const x =
      Math.cos(lat1 * DEG_TO_RAD) * Math.sin(lat2 * DEG_TO_RAD) -
      Math.sin(lat1 * DEG_TO_RAD) *
        Math.cos(lat2 * DEG_TO_RAD) *
        Math.cos(dLon);
    return ((Math.atan2(y, x) * RAD_TO_DEG) + 360) % 360;
  }

  /* ---------------------------------------------------------------- */
  /*  Debug / stats                                                    */
  /* ---------------------------------------------------------------- */

  getStats() {
    return { ...this.stats };
  }
}
