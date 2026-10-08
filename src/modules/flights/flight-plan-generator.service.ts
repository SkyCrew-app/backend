import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as polyline from 'polyline';
import { AirportData, RunwayDetail } from './interfaces/airport.interface';
import {
  FlightPlanOptions,
  FlightPlanResult,
} from './interfaces/flight-plan.interface';
import {
  AirspaceZoneData,
  NavaidData,
} from './interfaces/navigation.interface';
import {
  AircraftPerformanceProfile,
  FuelPolicy,
  PhaseTimeFuel,
  SegmentWind,
} from './interfaces/performance.interface';
import { FlightPhase, Waypoint } from './interfaces/waypoint.interface';
import {
  computeBearing,
  greatCirclePoints,
  haversineDistance,
  intermediatePoint,
} from './utils/geo.utils';
import { MetarData } from './metar.service';
import { AirwayGraphService } from './airway-graph.service';

interface RoutedPoint {
  ident: string;
  name: string;
  lat: number;
  lon: number;
}

interface GraphNode {
  id: string;
  lat: number;
  lon: number;
  ident: string;
  name: string;
  isAirport: boolean;
}

interface NodeEdge {
  to: string;
  cost: number;
}

const VFR_CATEGORIES = new Set([
  'local',
  'tourism',
  'training',
  'instruction',
]);

@Injectable()
export class FlightPlanGeneratorService implements OnModuleInit {
  private readonly logger = new Logger(FlightPlanGeneratorService.name);
  private navaids: NavaidData[] = [];
  private airspaces: AirspaceZoneData[] = [];

  constructor(private readonly airwayGraph: AirwayGraphService) {}

  onModuleInit(): void {
    this.navaids = this.loadJson<NavaidData>('navaids.fr.json');
    this.airspaces = this.loadJson<AirspaceZoneData>('airspaces.fr.json');
  }

  /* ================================================================ */
  /*  Public — Main entry point                                       */
  /* ================================================================ */

  generateFlightPlan(
    departure: AirportData,
    arrival: AirportData,
    cruiseSpeedKmh: number,
    maxAltitudeFt: number,
    flightCategory?: string,
    fuelConsumptionLph?: number,
    options?: FlightPlanOptions,
  ): FlightPlanResult {
    const perf = options?.performance ?? null;
    const distance_km = haversineDistance(
      departure.lat,
      departure.lon,
      arrival.lat,
      arrival.lon,
    );

    const trackBearing = computeBearing(
      departure.lat,
      departure.lon,
      arrival.lat,
      arrival.lon,
    );

    // Override flight rules from options
    const isVfr = options?.flight_rules
      ? options.flight_rules === 'VFR'
      : this.isVfrCategory(flightCategory);

    const intermediateCount = Math.min(
      20,
      Math.max(2, Math.round(distance_km / 90)),
    );

    const departureAltitude = departure.elevation_ft ?? 0;
    const arrivalAltitude = arrival.elevation_ft ?? 0;

    // Override cruise altitude from options
    const cruiseAltitude =
      options?.cruise_altitude_ft ??
      this.computeCruiseAltitude(maxAltitudeFt, trackBearing, isVfr);

    // Select runways
    const depRunway = this.selectRunway(
      departure,
      options?.preferred_runway_dep,
      options?.metar_departure,
    );
    const arrRunway = this.selectRunway(
      arrival,
      options?.preferred_runway_arr,
      options?.metar_arrival,
    );

    const route = this.buildAiRoute(
      departure,
      arrival,
      intermediateCount,
      cruiseAltitude,
      isVfr,
    );

    // Use performance profile climb/descent rates if available
    const climbRateFpm = perf?.climb?.rate_fpm ?? 800;
    const descentRateFpm = perf?.descent?.rate_fpm ?? 600;

    const { tocFraction, todFraction } = this.computeTocTodProgression(
      departureAltitude,
      arrivalAltitude,
      cruiseAltitude,
      distance_km,
      cruiseSpeedKmh,
      climbRateFpm,
      descentRateFpm,
    );

    // Use performance TAS or entity cruise speed
    const cruiseSpeedKts = perf?.cruise?.tas_kts
      ? perf.cruise.tas_kts
      : Math.round(cruiseSpeedKmh * 0.539957);

    const waypoints: Waypoint[] = this.buildWaypointSequence(
      departure,
      arrival,
      route,
      depRunway,
      arrRunway,
      departureAltitude,
      arrivalAltitude,
      cruiseAltitude,
      cruiseSpeedKts,
      trackBearing,
      distance_km,
      intermediateCount,
      tocFraction,
      todFraction,
      options,
      perf,
    );

    // ─── Wind correction per segment ───────────────────────
    const windDirDeg = this.extractWindDir(options);
    const windSpeedKts = this.extractWindSpeed(options);
    this.enrichWaypointsWithWind(waypoints, windDirDeg, windSpeedKts);

    // ─── Compute leg distances + cumulative time/fuel ──────
    const phaseBreakdown = this.computePhaseBreakdown(
      waypoints,
      perf,
      fuelConsumptionLph,
    );

    const totalFlightTimeHours =
      phaseBreakdown.reduce((sum, p) => sum + p.time_min, 0) / 60;

    // ─── ICAO Fuel Policy ──────────────────────────────────
    const fuelPolicy = this.computeIcaoFuelPolicy(
      phaseBreakdown,
      perf,
      fuelConsumptionLph,
      isVfr,
    );

    // ─── Wind summary ──────────────────────────────────────
    const windSummary = this.computeWindSummary(
      trackBearing,
      windDirDeg,
      windSpeedKts,
      cruiseSpeedKts,
    );

    return {
      distance_km,
      encoded_polyline: polyline.encode(
        waypoints.map((wp) => [wp.lat, wp.lon]),
      ),
      waypoints,
      flight_hours: totalFlightTimeHours || distance_km / cruiseSpeedKmh,
      estimated_fuel_liters: fuelPolicy?.total_liters ?? (fuelConsumptionLph
        ? Math.round((distance_km / cruiseSpeedKmh) * fuelConsumptionLph * 1.1)
        : undefined),
      departure_runway: depRunway ?? undefined,
      arrival_runway: arrRunway ?? undefined,
      fuel_policy: fuelPolicy,
      phase_breakdown: phaseBreakdown,
      wind_summary: windSummary,
      performance_profile: perf?.icao_type ?? undefined,
    };
  }

  /* ================================================================ */
  /*  Waypoint sequence builder                                       */
  /* ================================================================ */

  private buildWaypointSequence(
    departure: AirportData,
    arrival: AirportData,
    route: RoutedPoint[],
    depRunway: string | null,
    arrRunway: string | null,
    departureAltitude: number,
    arrivalAltitude: number,
    cruiseAltitude: number,
    cruiseSpeedKts: number,
    trackBearing: number,
    distanceKm: number,
    intermediateCount: number,
    tocFraction: number,
    todFraction: number,
    options?: FlightPlanOptions,
    perf?: AircraftPerformanceProfile | null,
  ): Waypoint[] {
    const waypoints: Waypoint[] = [];

    // ─── 1. APT — Departure ─────────────────────────────
    const depMetarStr = options?.metar_departure?.rawOb ?? null;
    waypoints.push({
      ident: departure.icao,
      type: 'APT',
      lat: departure.lat,
      lon: departure.lon,
      alt: departureAltitude,
      name: this.buildAptName(departure, depRunway, depMetarStr),
      phase: 'DEPARTURE',
      speed_kts: 0,
      heading_deg: Math.round(trackBearing),
    });

    // ─── 2. SID — Departure procedure (~20 km) ──────────
    const sidDistFraction = Math.min(0.15, 20 / distanceKm);
    const sidAlt = Math.min(departureAltitude + 1500, cruiseAltitude);
    const sidPoint = this.findPointAlongRoute(
      departure,
      arrival,
      route,
      sidDistFraction,
    );
    const climbIas = perf?.climb?.ias_kts ?? Math.round(cruiseSpeedKts * 0.7);
    waypoints.push({
      ident: depRunway ? `SID-${depRunway}` : 'SID',
      type: 'SID',
      lat: sidPoint.lat,
      lon: sidPoint.lon,
      alt: sidAlt,
      name: `Departure procedure ${departure.icao}${depRunway ? ` RWY ${depRunway}` : ''} | ${sidAlt}ft`,
      phase: 'INITIAL_CLIMB',
      speed_kts: climbIas,
      heading_deg: Math.round(trackBearing),
    });

    // ─── Compute progression for each FIX to know where
    //     TOC and TOD fall relative to them ───────────────
    const routeLen = route.length;

    // Create a full route including departure and arrival to compute total distance
    const fullRouteForProgression: RoutedPoint[] = [
      {
        ident: departure.icao,
        name: departure.name,
        lat: departure.lat,
        lon: departure.lon,
      },
      ...route,
      {
        ident: arrival.icao,
        name: arrival.name,
        lat: arrival.lat,
        lon: arrival.lon,
      },
    ];

    // Compute leg distances and total distance
    const legDistances: number[] = [];
    for (let i = 0; i < fullRouteForProgression.length - 1; i++) {
      legDistances.push(
        haversineDistance(
          fullRouteForProgression[i].lat,
          fullRouteForProgression[i].lon,
          fullRouteForProgression[i + 1].lat,
          fullRouteForProgression[i + 1].lon,
        ),
      );
    }
    const totalRouteDistance = legDistances.reduce((sum, d) => sum + d, 0);

    // Compute distance-based progression for each FIX
    const fixProgressions: number[] = [];
    if (totalRouteDistance > 0) {
      // Distance from departure to the first fix in `route`
      let accumulatedDistance = legDistances[0] ?? 0;
      for (let i = 0; i < route.length; i++) {
        fixProgressions.push(accumulatedDistance / totalRouteDistance);
        accumulatedDistance += legDistances[i + 1] ?? 0;
      }
    }

    // TOC position: along the route at tocFraction
    const tocPoint = this.findPointAlongRoute(
      departure,
      arrival,
      route,
      tocFraction,
    );

    // TOD position: along the route at todFraction
    const todPoint = this.findPointAlongRoute(
      departure,
      arrival,
      route,
      todFraction,
    );

    // STAR / APP fractions for filtering trailing FIX
    const starFraction = Math.max(0.85, 1 - 40 / distanceKm);

    // ─── 3–5. Interleave FIX, TOC, TOD in correct order ─
    let tocInserted = false;
    let todInserted = false;

    for (let i = 0; i < routeLen; i++) {
      const prog = fixProgressions[i];
      const point = route[i];

      // Skip FIX points that are before the SID or after the STAR zone
      if (prog <= sidDistFraction + 0.02) continue;
      if (prog >= starFraction - 0.02) continue;

      // Insert TOC before the first FIX that is past tocFraction
      if (!tocInserted && prog > tocFraction) {
        waypoints.push({
          ident: 'TOC',
          type: 'TOC',
          lat: tocPoint.lat,
          lon: tocPoint.lon,
          alt: cruiseAltitude,
          name: `Top of climb FL${Math.round(cruiseAltitude / 100)}`,
          phase: 'CLIMB',
          speed_kts: perf?.climb?.ias_kts ?? Math.round(cruiseSpeedKts * 0.85),
          heading_deg: Math.round(trackBearing),
        });
        tocInserted = true;
      }

      // Insert TOD before the first FIX that is past todFraction
      if (!todInserted && prog > todFraction) {
        waypoints.push({
          ident: 'TOD',
          type: 'TOD',
          lat: todPoint.lat,
          lon: todPoint.lon,
          alt: cruiseAltitude,
          name: `Top of descent FL${Math.round(cruiseAltitude / 100)}`,
          phase: 'DESCENT',
          speed_kts: perf?.descent?.ias_kts ?? Math.round(cruiseSpeedKts * 0.9),
          heading_deg: Math.round(trackBearing),
        });
        todInserted = true;
      }

      // Compute altitude at this progression
      const altitude = this.computeAltitudeAtProgression(
        prog,
        departureAltitude,
        arrivalAltitude,
        cruiseAltitude,
        tocFraction,
        todFraction,
      );

      let phase: FlightPhase;
      let phaseSpeed: number;
      if (prog <= tocFraction) {
        phase = 'CLIMB';
        phaseSpeed = perf?.climb?.ias_kts ?? Math.round(cruiseSpeedKts * 0.85);
      } else if (prog >= todFraction) {
        phase = 'DESCENT';
        phaseSpeed = perf?.descent?.ias_kts ?? Math.round(cruiseSpeedKts * 0.9);
      } else {
        phase = 'CRUISE';
        phaseSpeed = cruiseSpeedKts;
      }

      const nextPoint = route[i + 1] ?? arrival;
      const legBearing = computeBearing(
        point.lat,
        point.lon,
        nextPoint.lat,
        nextPoint.lon,
      );

      waypoints.push({
        ident: point.ident,
        type: 'FIX',
        lat: point.lat,
        lon: point.lon,
        alt: altitude,
        name: `${point.name} | FL${Math.round(altitude / 100)}`,
        phase,
        speed_kts: phaseSpeed,
        heading_deg: Math.round(legBearing),
      });
    }

    // Insert TOC if all FIX points were before tocFraction (edge case)
    if (!tocInserted) {
      waypoints.push({
        ident: 'TOC',
        type: 'TOC',
        lat: tocPoint.lat,
        lon: tocPoint.lon,
        alt: cruiseAltitude,
        name: `Top of climb FL${Math.round(cruiseAltitude / 100)}`,
        phase: 'CLIMB',
        speed_kts: perf?.climb?.ias_kts ?? Math.round(cruiseSpeedKts * 0.85),
        heading_deg: Math.round(trackBearing),
      });
    }

    // Insert TOD if it was never triggered (all FIX before todFraction)
    if (!todInserted) {
      waypoints.push({
        ident: 'TOD',
        type: 'TOD',
        lat: todPoint.lat,
        lon: todPoint.lon,
        alt: cruiseAltitude,
        name: `Top of descent FL${Math.round(cruiseAltitude / 100)}`,
        phase: 'DESCENT',
        speed_kts: perf?.descent?.ias_kts ?? Math.round(cruiseSpeedKts * 0.9),
        heading_deg: Math.round(trackBearing),
      });
    }

    // ─── 6. STAR — Standard arrival (~40 km from arrival) ─
    const starAlt = arrivalAltitude + 3000;
    const starPoint = this.findPointAlongRoute(
      departure,
      arrival,
      route,
      starFraction,
    );
    const descentIas = perf?.descent?.ias_kts ?? Math.round(cruiseSpeedKts * 0.8);
    waypoints.push({
      ident: arrRunway ? `STAR-${arrRunway}` : 'STAR',
      type: 'STAR',
      lat: starPoint.lat,
      lon: starPoint.lon,
      alt: starAlt,
      name: `Standard arrival ${arrival.icao}${arrRunway ? ` RWY ${arrRunway}` : ''} | ${starAlt}ft`,
      phase: 'APPROACH',
      speed_kts: descentIas,
      heading_deg: Math.round(trackBearing),
    });

    // ─── 7. APP — Final approach (~16 km from arrival) ───
    const appDistFraction = Math.max(0.92, 1 - 16 / distanceKm);
    const appAlt = arrivalAltitude + 1500;
    const appPoint = this.findPointAlongRoute(
      departure,
      arrival,
      route,
      appDistFraction,
    );
    const approachIas = perf?.approach?.ias_kts ?? Math.round(cruiseSpeedKts * 0.6);
    waypoints.push({
      ident: arrRunway ? `APP-${arrRunway}` : 'APP',
      type: 'APP',
      lat: appPoint.lat,
      lon: appPoint.lon,
      alt: appAlt,
      name: `Final approach ${arrival.icao}${arrRunway ? ` RWY ${arrRunway}` : ''} | ${appAlt}ft`,
      phase: 'FINAL',
      speed_kts: approachIas,
      heading_deg: Math.round(trackBearing),
    });

    // ─── 8. APT — Arrival ────────────────────────────────
    const arrMetarStr = options?.metar_arrival?.rawOb ?? null;
    const vrefKts = perf?.approach?.vref_kts ?? Math.round(cruiseSpeedKts * 0.5);
    waypoints.push({
      ident: arrival.icao,
      type: 'APT',
      lat: arrival.lat,
      lon: arrival.lon,
      alt: arrivalAltitude,
      name: this.buildAptName(arrival, arrRunway, arrMetarStr),
      phase: 'LANDING',
      speed_kts: vrefKts,
      heading_deg: Math.round(trackBearing),
    });

    return waypoints;
  }

  /* ================================================================ */
  /*  Airport waypoint name builder                                   */
  /* ================================================================ */

  private buildAptName(
    airport: AirportData,
    runway: string | null,
    metarRaw: string | null,
  ): string {
    const parts = [
      airport.name,
      airport.city ?? 'Unknown',
      airport.country ?? 'N/A',
      `Elev ${airport.elevation_ft ?? 0}ft`,
      `RWY ${runway ?? ((airport.runways ?? []).join('/') || 'N/A')}`,
      `TWR ${this.findFreq(airport, 'TWR')}`,
      `ATIS ${this.findFreq(airport, 'ATIS')}`,
      `GND ${this.findFreq(airport, 'GND')}`,
    ];

    if (metarRaw) {
      parts.push(`METAR ${metarRaw}`);
    }

    return parts.join(' | ');
  }

  /* ================================================================ */
  /*  Runway selection                                                */
  /* ================================================================ */

  private selectRunway(
    airport: AirportData,
    preferredRunway?: string,
    metar?: MetarData | null,
  ): string | null {
    if (!airport.runways?.length) return null;

    // If user specified a preferred runway, validate and use it
    if (preferredRunway) {
      const allIdents = airport.runways.flatMap((rwy) => rwy.split('/'));
      if (allIdents.includes(preferredRunway.toUpperCase())) {
        return preferredRunway.toUpperCase();
      }
    }

    // If METAR wind data is available, select the best runway for the wind
    if (
      metar &&
      typeof metar.wdir === 'number' &&
      airport.runway_details?.length
    ) {
      return this.bestRunwayForWind(airport.runway_details, metar.wdir);
    }

    // Default: first runway, first end
    return airport.runways[0]?.split('/')[0] ?? null;
  }

  private bestRunwayForWind(
    details: RunwayDetail[],
    windDir: number,
  ): string | null {
    let bestIdent: string | null = null;
    let bestCrosswind = Infinity;

    for (const rwy of details) {
      for (const ident of [rwy.le_ident, rwy.he_ident]) {
        if (!ident) continue;

        // Parse heading from runway identifier (e.g., "09L" -> 090deg)
        const numericPart = parseInt(ident.replace(/\D/g, ''), 10);
        if (isNaN(numericPart)) continue;

        const rwyHeading = numericPart * 10;
        const angleDiff = Math.abs(windDir - rwyHeading);
        const crosswindAngle = Math.min(angleDiff, 360 - angleDiff);
        // Lower crosswind component = better alignment
        const crosswindComponent = Math.sin(
          (crosswindAngle * Math.PI) / 180,
        );

        if (crosswindComponent < bestCrosswind) {
          bestCrosswind = crosswindComponent;
          bestIdent = ident;
        }
      }
    }

    return bestIdent;
  }

  /* ================================================================ */
  /*  Frequency finder                                                */
  /* ================================================================ */

  private findFreq(airport: AirportData, type: string): string {
    const freq = airport.frequencies?.find((f) =>
      f.type.toUpperCase().includes(type.toUpperCase()),
    );
    return freq?.value ?? 'N/A';
  }

  /* ================================================================ */
  /*  Route building (A* + fallback)                                  */
  /* ================================================================ */

  private buildAiRoute(
    departure: AirportData,
    arrival: AirportData,
    targetPoints: number,
    cruiseAltitudeFt: number,
    isVfr: boolean,
  ): RoutedPoint[] {
    // ─── 1. Try the new airway graph (Dijkstra on real airways) ───
    const flightLevelHecto = Math.round(cruiseAltitudeFt / 100);
    const airwayRoute = this.airwayGraph.findRoute(
      departure.lat,
      departure.lon,
      arrival.lat,
      arrival.lon,
      flightLevelHecto,
      isVfr,
    );

    if (airwayRoute && airwayRoute.waypoints.length >= 2) {
      this.logger.log(
        `Airway route found: ${airwayRoute.waypoints.map((w) => w.ident).join(' → ')} ` +
          `(${airwayRoute.totalDistanceNm.toFixed(0)} NM, ${airwayRoute.waypoints.length} pts)`,
      );
      const routeString = this.airwayGraph.buildRouteString(airwayRoute);
      this.logger.log(`Route string: ${routeString}`);

      const mappedWaypoints = airwayRoute.waypoints.map((wp) => ({
        ident: wp.ident,
        name: wp.airwayIn
          ? `${wp.type} ${wp.name ?? wp.ident} [${wp.airwayIn}]`
          : `${wp.type} ${wp.name ?? wp.ident}`,
        lat: wp.lat,
        lon: wp.lon,
      }));
      return this.sanitizeRouteProgress(mappedWaypoints, arrival);
    }

    this.logger.warn('Airway graph routing failed, trying legacy A* on navaids…');

    // ─── 2. Fallback: legacy A* on navaids.fr.json ────────────────
    const astarRoute = this.findRouteWithAStar(
      departure,
      arrival,
      cruiseAltitudeFt,
      isVfr,
    );
    if (astarRoute.length >= 2) {
      const redistributed = this.redistributeRoutePoints(
        astarRoute,
        targetPoints,
      );
      return this.sanitizeRouteProgress(redistributed, arrival);
    }

    this.logger.warn('Legacy A* also failed, falling back to great circle interpolation');

    // ─── 3. Last resort: great circle interpolation ───────────────
    const trackBearing = computeBearing(
      departure.lat,
      departure.lon,
      arrival.lat,
      arrival.lon,
    );

    const fallbackPoints = greatCirclePoints(
      departure.lat,
      departure.lon,
      arrival.lat,
      arrival.lon,
      targetPoints,
    );

    const fallbackRoute = fallbackPoints.map((point, index) => {
      const deconflicted = this.avoidRestrictedAreas(
        point.lat,
        point.lon,
        trackBearing,
        cruiseAltitudeFt,
      );
      return {
        ident: this.buildFixIdent(deconflicted.lat, deconflicted.lon),
        name: `AI-GEN FIX ${(index + 1).toString().padStart(2, '0')} ${departure.icao}-${arrival.icao}`,
        lat: deconflicted.lat,
        lon: deconflicted.lon,
      };
    });

    return this.sanitizeRouteProgress(fallbackRoute, arrival);
  }

  /* ================================================================ */
  /*  A* Pathfinding                                                  */
  /* ================================================================ */

  private findRouteWithAStar(
    departure: AirportData,
    arrival: AirportData,
    cruiseAltitudeFt: number,
    isVfr: boolean,
  ): RoutedPoint[] {
    const nodes = this.buildGraphNodes(departure, arrival);
    const adjacency = this.buildGraphEdges(nodes, cruiseAltitudeFt, isVfr);

    const start = 'DEP';
    const goal = 'ARR';

    const openSet = new Set<string>([start]);
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>([[start, 0]]);
    const fScore = new Map<string, number>([
      [start, this.heuristic(nodes.get(start)!, nodes.get(goal)!)],
    ]);

    while (openSet.size > 0) {
      const current = this.lowest(openSet, fScore);
      if (!current) break;

      if (current === goal) {
        return this.reconstructPath(cameFrom, current)
          .map((nodeId) => nodes.get(nodeId)!)
          .filter((node) => !node.isAirport)
          .map((node) => ({
            ident: node.ident,
            name: node.name,
            lat: node.lat,
            lon: node.lon,
          }));
      }

      openSet.delete(current);
      for (const edge of adjacency.get(current) ?? []) {
        const tentative =
          (gScore.get(current) ?? Number.POSITIVE_INFINITY) + edge.cost;

        if (tentative < (gScore.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
          cameFrom.set(edge.to, current);
          gScore.set(edge.to, tentative);

          const estimated =
            tentative +
            this.heuristic(nodes.get(edge.to)!, nodes.get(goal)!);
          fScore.set(edge.to, estimated);
          openSet.add(edge.to);
        }
      }
    }

    return [];
  }

  private buildGraphNodes(
    departure: AirportData,
    arrival: AirportData,
  ): Map<string, GraphNode> {
    const nodes = new Map<string, GraphNode>();

    nodes.set('DEP', {
      id: 'DEP',
      lat: departure.lat,
      lon: departure.lon,
      ident: departure.icao,
      name: `APT ${departure.name}`,
      isAirport: true,
    });

    nodes.set('ARR', {
      id: 'ARR',
      lat: arrival.lat,
      lon: arrival.lon,
      ident: arrival.icao,
      name: `APT ${arrival.name}`,
      isAirport: true,
    });

    const directDistance = haversineDistance(
      departure.lat,
      departure.lon,
      arrival.lat,
      arrival.lon,
    );

    // Corridor dynamique : 30% de la distance, min 150km, max 400km
    const corridorSlack = Math.min(400, Math.max(150, directDistance * 0.3));

    this.navaids.forEach((navaid) => {
      const toDep = haversineDistance(
        departure.lat,
        departure.lon,
        navaid.lat,
        navaid.lon,
      );
      const toArr = haversineDistance(
        arrival.lat,
        arrival.lon,
        navaid.lat,
        navaid.lon,
      );
      const detour = toDep + toArr - directDistance;

      if (detour <= corridorSlack) {
        nodes.set(navaid.ident, {
          id: navaid.ident,
          lat: navaid.lat,
          lon: navaid.lon,
          ident: navaid.ident,
          name: `${navaid.type} ${navaid.name}`,
          isAirport: false,
        });
      }
    });

    return nodes;
  }

  private buildGraphEdges(
    nodes: Map<string, GraphNode>,
    cruiseAltitudeFt: number,
    isVfr: boolean,
  ): Map<string, NodeEdge[]> {
    const entries = [...nodes.values()];
    const adjacency = new Map<string, NodeEdge[]>();

    entries.forEach((from) => {
      const neighbors: NodeEdge[] = [];

      entries.forEach((to) => {
        if (from.id === to.id) return;

        const legDistance = haversineDistance(
          from.lat,
          from.lon,
          to.lat,
          to.lon,
        );
        const minLeg = from.isAirport || to.isAirport ? 30 : 40;
        if (legDistance < minLeg || legDistance > 260) return;

        const penalty = this.segmentPenalty(
          from.lat,
          from.lon,
          to.lat,
          to.lon,
          cruiseAltitudeFt,
        );

        // IFR : bonus VOR-to-VOR, penalite FIX-only
        let navaidBonus = 0;
        if (!isVfr) {
          if (from.name.startsWith('VOR') && to.name.startsWith('VOR')) {
            navaidBonus = -30;
          }
          if (from.name.startsWith('FIX') || to.name.startsWith('FIX')) {
            navaidBonus += 15;
          }
        }

        neighbors.push({
          to: to.id,
          cost: legDistance + penalty + navaidBonus,
        });
      });

      adjacency.set(from.id, neighbors);
    });

    return adjacency;
  }

  private segmentPenalty(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    flightAltitudeFt: number,
  ): number {
    let penalty = 0;

    const points = 8;
    for (let i = 1; i <= points; i += 1) {
      const t = i / points;
      const lat = lat1 + (lat2 - lat1) * t;
      const lon = lon1 + (lon2 - lon1) * t;

      for (const zone of this.airspaces) {
        const inLat = lat >= zone.minLat && lat <= zone.maxLat;
        const inLon = lon >= zone.minLon && lon <= zone.maxLon;
        const inAlt =
          flightAltitudeFt >= zone.floor_ft &&
          flightAltitudeFt <= zone.ceiling_ft;
        if (inLat && inLon && inAlt) {
          penalty += 250;
        }
      }
    }

    return penalty;
  }

  /* ================================================================ */
  /*  A* helpers                                                      */
  /* ================================================================ */

  private heuristic(from: GraphNode, to: GraphNode): number {
    return haversineDistance(from.lat, from.lon, to.lat, to.lon);
  }

  private lowest(
    openSet: Set<string>,
    fScore: Map<string, number>,
  ): string | null {
    let best: string | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    openSet.forEach((nodeId) => {
      const score = fScore.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (score < bestScore) {
        bestScore = score;
        best = nodeId;
      }
    });

    return best;
  }

  private reconstructPath(
    cameFrom: Map<string, string>,
    current: string,
  ): string[] {
    const totalPath = [current];
    let cursor = current;

    while (cameFrom.has(cursor)) {
      cursor = cameFrom.get(cursor)!;
      totalPath.unshift(cursor);
    }

    return totalPath;
  }

  private redistributeRoutePoints(
    route: RoutedPoint[],
    target: number,
  ): RoutedPoint[] {
    if (route.length === target) {
      return route;
    }

    if (route.length > target) {
      const step = route.length / target;
      return Array.from(
        { length: target },
        (_, index) => route[Math.floor(index * step)],
      );
    }

    const extended: RoutedPoint[] = [...route];
    while (extended.length < target) {
      const insertionIndex = Math.max(1, Math.floor(extended.length / 2));
      const a = extended[insertionIndex - 1];
      const b = extended[Math.min(insertionIndex, extended.length - 1)];

      const lat = (a.lat + b.lat) / 2;
      const lon = (a.lon + b.lon) / 2;
      extended.splice(insertionIndex, 0, {
        ident: this.buildFixIdent(lat, lon),
        name: `AI-INTERP ${a.ident}-${b.ident}`,
        lat,
        lon,
      });
    }

    return extended.slice(0, target);
  }

  private sanitizeRouteProgress(
    route: RoutedPoint[],
    arrival: AirportData,
  ): RoutedPoint[] {
    if (route.length <= 1) return route;

    const sanitized: RoutedPoint[] = [];
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const point of route) {
      const distanceToArrival = haversineDistance(
        point.lat,
        point.lon,
        arrival.lat,
        arrival.lon,
      );

      if (distanceToArrival <= bestDistance + 8) {
        sanitized.push(point);
        bestDistance = Math.min(bestDistance, distanceToArrival);
      }
    }

    return sanitized.length > 0 ? sanitized : route;
  }

  private findPointAlongRoute(
    departure: AirportData,
    arrival: AirportData,
    route: RoutedPoint[],
    fraction: number,
  ): { lat: number; lon: number } {
    const depPoint: RoutedPoint = {
      ident: departure.icao,
      name: departure.name,
      lat: departure.lat,
      lon: departure.lon,
    };
    const arrPoint: RoutedPoint = {
      ident: arrival.icao,
      name: arrival.name,
      lat: arrival.lat,
      lon: arrival.lon,
    };

    const fullRoute: RoutedPoint[] = [depPoint, ...route, arrPoint];

    const routeDistances = [];
    let totalDistance = 0;
    for (let i = 0; i < fullRoute.length - 1; i++) {
      const dist = haversineDistance(
        fullRoute[i].lat,
        fullRoute[i].lon,
        fullRoute[i + 1].lat,
        fullRoute[i + 1].lon,
      );
      routeDistances.push(dist);
      totalDistance += dist;
    }

    if (totalDistance === 0) {
      return { lat: departure.lat, lon: departure.lon };
    }

    const targetDistance = totalDistance * fraction;
    let accumulatedDistance = 0;

    for (let i = 0; i < fullRoute.length - 1; i++) {
      const segmentDistance = routeDistances[i];
      if (segmentDistance === 0) continue;

      if (accumulatedDistance + segmentDistance >= targetDistance) {
        const segmentFraction =
          (targetDistance - accumulatedDistance) / segmentDistance;
        return intermediatePoint(
          fullRoute[i].lat,
          fullRoute[i].lon,
          fullRoute[i + 1].lat,
          fullRoute[i + 1].lon,
          segmentFraction,
        );
      }
      accumulatedDistance += segmentDistance;
    }

    // Fallback to the arrival point if fraction is 1 or something went wrong
    return { lat: arrival.lat, lon: arrival.lon };
  }

  /* ================================================================ */
  /*  Altitude computations                                           */
  /* ================================================================ */

  private computeCruiseAltitude(
    maxAltitudeFt: number,
    trackBearingDeg: number,
    isVfr: boolean,
  ): number {
    const target = Math.round(maxAltitudeFt * 0.82);

    // ICAO semicircular rule: based on MAGNETIC track
    // Eastbound: 0° ≤ track < 180° → odd thousands (IFR) / odd+500 (VFR)
    // Westbound: 180° ≤ track < 360° → even thousands (IFR) / even+500 (VFR)
    const normalizedTrack = ((trackBearingDeg % 360) + 360) % 360;
    const isEastbound = normalizedTrack >= 0 && normalizedTrack < 180;

    if (isVfr) {
      // VFR : impairs +500 eastbound, pairs +500 westbound
      const base = isEastbound
        ? this.nearestOddThousand(target)
        : this.nearestEvenThousand(target);
      return Math.max(3500, base + 500);
    }

    // IFR : impairs eastbound, pairs westbound
    return isEastbound
      ? Math.max(3000, this.nearestOddThousand(target))
      : Math.max(4000, this.nearestEvenThousand(target));
  }

  private nearestOddThousand(alt: number): number {
    const thousands = Math.round(alt / 1000);
    return (thousands % 2 === 1 ? thousands : thousands - 1) * 1000;
  }

  private nearestEvenThousand(alt: number): number {
    const thousands = Math.round(alt / 1000);
    return (thousands % 2 === 0 ? thousands : thousands - 1) * 1000;
  }

  private computeTocTodProgression(
    departureAltFt: number,
    arrivalAltFt: number,
    cruiseAltFt: number,
    distanceKm: number,
    cruiseSpeedKmh: number,
    climbRateFpm = 800,
    descentRateFpm = 600,
  ): { tocFraction: number; todFraction: number } {

    const climbFt = Math.max(0, cruiseAltFt - departureAltFt);
    const descentFt = Math.max(0, cruiseAltFt - arrivalAltFt);

    // Climb: time = altitude to gain / climb rate
    const climbTimeMin = climbRateFpm > 0 ? climbFt / climbRateFpm : 0;
    // Climb speed: 70% of cruise (realistic for light GA aircraft)
    const climbSpeedKmh = cruiseSpeedKmh * 0.70;
    const climbDistanceKm = (climbTimeMin / 60) * climbSpeedKmh;

    // Descent: standard 3:1 rule (3 NM per 1000 ft = 5.556 km per 1000 ft)
    // This is the most commonly used method in both GA and airline ops
    const descentDistanceKm = (descentFt / 1000) * 5.556;

    const tocFraction = Math.min(
      0.35,
      Math.max(0.03, climbDistanceKm / distanceKm),
    );
    const todFraction = Math.min(
      0.97,
      Math.max(0.65, 1 - descentDistanceKm / distanceKm),
    );

    return { tocFraction, todFraction };
  }

  private computeAltitudeAtProgression(
    progression: number,
    departureAltitude: number,
    arrivalAltitude: number,
    cruiseAltitude: number,
    tocFraction: number,
    todFraction: number,
  ): number {
    let altitude: number;

    if (progression <= tocFraction) {
      altitude =
        departureAltitude +
        (cruiseAltitude - departureAltitude) * (progression / tocFraction);
    } else if (progression >= todFraction) {
      altitude =
        cruiseAltitude +
        (arrivalAltitude - cruiseAltitude) *
          ((progression - todFraction) / (1 - todFraction));
    } else {
      altitude = cruiseAltitude;
    }

    return Math.max(0, Math.round(altitude / 500) * 500);
  }

  /* ================================================================ */
  /*  Airspace avoidance                                              */
  /* ================================================================ */

  private avoidRestrictedAreas(
    lat: number,
    lon: number,
    bearingDeg: number,
    flightAltitudeFt: number,
  ): { lat: number; lon: number } {
    for (const zone of this.airspaces) {
      const inLat = lat >= zone.minLat && lat <= zone.maxLat;
      const inLon = lon >= zone.minLon && lon <= zone.maxLon;
      const inAlt =
        flightAltitudeFt >= zone.floor_ft &&
        flightAltitudeFt <= zone.ceiling_ft;
      if (inLat && inLon && inAlt) {
        return this.findNearestExitPoint(lat, lon, zone, bearingDeg);
      }
    }

    return { lat, lon };
  }

  private findNearestExitPoint(
    lat: number,
    lon: number,
    zone: AirspaceZoneData,
    bearingDeg: number,
  ): { lat: number; lon: number } {
    const margin = 0.05; // ~5.5km de marge hors zone

    const candidates = [
      {
        lat: zone.maxLat + margin,
        lon,
        label: 'N',
        dist: zone.maxLat - lat,
      },
      {
        lat: zone.minLat - margin,
        lon,
        label: 'S',
        dist: lat - zone.minLat,
      },
      {
        lat,
        lon: zone.maxLon + margin,
        label: 'E',
        dist: zone.maxLon - lon,
      },
      {
        lat,
        lon: zone.minLon - margin,
        label: 'W',
        dist: lon - zone.minLon,
      },
    ];

    // Preferer les sorties alignees avec la direction du vol
    const bearingRad = (bearingDeg * Math.PI) / 180;
    const preferN = Math.cos(bearingRad);
    const preferE = Math.sin(bearingRad);

    const scored = candidates.map((c) => {
      let alignmentBonus = 0;
      if (c.label === 'N') alignmentBonus = preferN * 0.5;
      if (c.label === 'S') alignmentBonus = -preferN * 0.5;
      if (c.label === 'E') alignmentBonus = preferE * 0.5;
      if (c.label === 'W') alignmentBonus = -preferE * 0.5;
      return { ...c, score: c.dist - alignmentBonus };
    });

    scored.sort((a, b) => a.score - b.score);

    // Verifier que la sortie ne tombe pas dans une autre zone
    for (const candidate of scored) {
      let isInsideAnotherZone = false;
      for (const otherZone of this.airspaces) {
        if (otherZone.id === zone.id) continue;
        const inLat =
          candidate.lat >= otherZone.minLat &&
          candidate.lat <= otherZone.maxLat;
        const inLon =
          candidate.lon >= otherZone.minLon &&
          candidate.lon <= otherZone.maxLon;
        if (inLat && inLon) {
          isInsideAnotherZone = true;
          break;
        }
      }
      if (!isInsideAnotherZone) {
        return { lat: candidate.lat, lon: candidate.lon };
      }
    }

    // Fallback : premier candidat si tous sont dans d'autres zones
    return { lat: scored[0].lat, lon: scored[0].lon };
  }

  /* ================================================================ */
  /*  Wind Correction Angle (WCA)                                     */
  /* ================================================================ */

  private computeWCA(
    trackDeg: number,
    windDirDeg: number,
    windSpeedKts: number,
    tasKts: number,
  ): { wca_deg: number; ground_speed_kts: number; headwind_kts: number; crosswind_kts: number } {
    if (windSpeedKts <= 0 || tasKts <= 0) {
      return { wca_deg: 0, ground_speed_kts: tasKts, headwind_kts: 0, crosswind_kts: 0 };
    }

    // Wind angle relative to track (wind comes FROM windDirDeg)
    const windAngleRad = ((windDirDeg - trackDeg) * Math.PI) / 180;

    // Headwind component (positive = headwind, negative = tailwind)
    const headwind = windSpeedKts * Math.cos(windAngleRad);
    const crosswind = windSpeedKts * Math.sin(windAngleRad);

    // WCA = arcsin(Vw * sin(wind_angle) / TAS)
    const sinWCA = (windSpeedKts * Math.sin(windAngleRad)) / tasKts;
    const clampedSinWCA = Math.max(-1, Math.min(1, sinWCA));
    const wcaRad = Math.asin(clampedSinWCA);
    const wcaDeg = (wcaRad * 180) / Math.PI;

    // Ground speed = TAS * cos(WCA) - Vw * cos(wind_angle)
    // More accurately: GS = TAS*cos(WCA) - headwind
    const gs = tasKts * Math.cos(wcaRad) - headwind;

    return {
      wca_deg: Math.round(wcaDeg * 10) / 10,
      ground_speed_kts: Math.max(tasKts * 0.5, Math.round(gs)),
      headwind_kts: Math.round(headwind),
      crosswind_kts: Math.round(Math.abs(crosswind)),
    };
  }

  private extractWindDir(options?: FlightPlanOptions): number {
    if (options?.metar_departure && typeof options.metar_departure.wdir === 'number') {
      if (options?.metar_arrival && typeof options.metar_arrival.wdir === 'number') {
        return ((options.metar_departure.wdir as number) + (options.metar_arrival.wdir as number)) / 2;
      }
      return options.metar_departure.wdir as number;
    }
    return 0;
  }

  private extractWindSpeed(options?: FlightPlanOptions): number {
    if (options?.metar_departure && typeof options.metar_departure.wspd === 'number') {
      if (options?.metar_arrival && typeof options.metar_arrival.wspd === 'number') {
        return (options.metar_departure.wspd + options.metar_arrival.wspd) / 2;
      }
      return options.metar_departure.wspd;
    }
    return 0;
  }

  private enrichWaypointsWithWind(
    waypoints: Waypoint[],
    windDirDeg: number,
    windSpeedKts: number,
  ): void {
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const tas = wp.speed_kts ?? 0;
      const track = wp.heading_deg ?? 0;

      if (tas > 0 && windSpeedKts > 0) {
        const wind = this.computeWCA(track, windDirDeg, windSpeedKts, tas);
        wp.wind_correction_deg = wind.wca_deg;
        wp.ground_speed_kts = wind.ground_speed_kts;
      } else {
        wp.ground_speed_kts = tas;
        wp.wind_correction_deg = 0;
      }

      // Compute leg distance to next waypoint
      if (i < waypoints.length - 1) {
        const next = waypoints[i + 1];
        const legKm = haversineDistance(wp.lat, wp.lon, next.lat, next.lon);
        wp.leg_distance_nm = Math.round(legKm * 0.539957 * 10) / 10;
      } else {
        wp.leg_distance_nm = 0;
      }
    }
  }

  /* ================================================================ */
  /*  Phase breakdown & ICAO fuel policy                              */
  /* ================================================================ */

  private computePhaseBreakdown(
    waypoints: Waypoint[],
    perf: AircraftPerformanceProfile | null,
    fallbackConsumptionLph?: number,
  ): PhaseTimeFuel[] {
    const phases: PhaseTimeFuel[] = [];
    let cumulativeTimeMin = 0;

    // Default fuel rates per phase
    const climbFuelLph = perf?.climb?.fuel_lph ?? (fallbackConsumptionLph ? fallbackConsumptionLph * 1.2 : 35);
    const cruiseFuelLph = perf?.cruise?.fuel_lph ?? fallbackConsumptionLph ?? 30;
    const descentFuelLph = perf?.descent?.fuel_lph ?? (fallbackConsumptionLph ? fallbackConsumptionLph * 0.6 : 18);
    const approachFuelLph = perf?.approach?.fuel_lph ?? (fallbackConsumptionLph ? fallbackConsumptionLph * 0.8 : 22);

    for (let i = 0; i < waypoints.length - 1; i++) {
      const wp = waypoints[i];
      const next = waypoints[i + 1];
      const legDistNm = wp.leg_distance_nm ?? 0;
      const gs = wp.ground_speed_kts ?? wp.speed_kts ?? 100;

      const legTimeHours = gs > 0 ? legDistNm / gs : 0;
      const legTimeMin = legTimeHours * 60;

      // Select fuel rate based on phase
      let fuelRate: number;
      switch (wp.phase) {
        case 'DEPARTURE':
        case 'INITIAL_CLIMB':
        case 'CLIMB':
          fuelRate = climbFuelLph;
          break;
        case 'DESCENT':
          fuelRate = descentFuelLph;
          break;
        case 'APPROACH':
        case 'FINAL':
        case 'LANDING':
          fuelRate = approachFuelLph;
          break;
        default:
          fuelRate = cruiseFuelLph;
      }

      const legFuelLiters = legTimeHours * fuelRate;

      wp.time_from_dep_min = Math.round(cumulativeTimeMin * 10) / 10;
      cumulativeTimeMin += legTimeMin;

      phases.push({
        phase: wp.phase ?? 'CRUISE',
        time_min: Math.round(legTimeMin * 10) / 10,
        fuel_liters: Math.round(legFuelLiters * 10) / 10,
        distance_nm: legDistNm,
      });
    }

    // Set time on last waypoint
    const lastWp = waypoints[waypoints.length - 1];
    if (lastWp) {
      lastWp.time_from_dep_min = Math.round(cumulativeTimeMin * 10) / 10;
    }

    return phases;
  }

  private computeIcaoFuelPolicy(
    phaseBreakdown: PhaseTimeFuel[],
    perf: AircraftPerformanceProfile | null,
    fallbackConsumptionLph?: number,
    isVfr = true,
  ): FuelPolicy | undefined {
    const cruiseFuelLph = perf?.cruise?.fuel_lph ?? fallbackConsumptionLph;
    if (!cruiseFuelLph) return undefined;

    // Taxi fuel
    const taxiFuel = perf?.taxi_fuel_liters ?? 5;

    // Trip fuel (sum of all phase fuel)
    const tripFuel = phaseBreakdown.reduce((sum, p) => sum + p.fuel_liters, 0);

    // Contingency: 5% of trip fuel (ICAO minimum)
    const contingencyFuel = tripFuel * 0.05;

    // Alternate fuel: 30 minutes at cruise consumption
    const alternateFuel = (cruiseFuelLph * 30) / 60;

    // Final reserve: 45 min VFR, 30 min IFR at cruise consumption
    const reserveMinutes = isVfr ? 45 : 30;
    const finalReserveFuel = (cruiseFuelLph * reserveMinutes) / 60;

    const totalFuel = taxiFuel + tripFuel + contingencyFuel + alternateFuel + finalReserveFuel;

    return {
      taxi_liters: Math.round(taxiFuel * 10) / 10,
      trip_liters: Math.round(tripFuel * 10) / 10,
      contingency_liters: Math.round(contingencyFuel * 10) / 10,
      alternate_liters: Math.round(alternateFuel * 10) / 10,
      final_reserve_liters: Math.round(finalReserveFuel * 10) / 10,
      total_liters: Math.round(totalFuel * 10) / 10,
    };
  }

  private computeWindSummary(
    trackDeg: number,
    windDirDeg: number,
    windSpeedKts: number,
    cruiseSpeedKts: number,
  ): SegmentWind | undefined {
    if (windSpeedKts <= 0) return undefined;

    const wind = this.computeWCA(trackDeg, windDirDeg, windSpeedKts, cruiseSpeedKts);
    return {
      wind_dir_deg: Math.round(windDirDeg),
      wind_speed_kts: Math.round(windSpeedKts),
      headwind_kts: wind.headwind_kts,
      crosswind_kts: wind.crosswind_kts,
      wca_deg: wind.wca_deg,
      ground_speed_kts: wind.ground_speed_kts,
    };
  }

  /* ================================================================ */
  /*  Utility methods                                                 */
  /* ================================================================ */

  private buildFixIdent(lat: number, lon: number): string {
    const latPrefix = lat >= 0 ? 'N' : 'S';
    const lonPrefix = lon >= 0 ? 'E' : 'W';
    const latAbs = Math.abs(lat);
    const lonAbs = Math.abs(lon);

    const latDeg = Math.floor(latAbs).toString().padStart(2, '0');
    const latMin = Math.floor((latAbs % 1) * 60)
      .toString()
      .padStart(2, '0');
    const lonDeg = Math.floor(lonAbs).toString().padStart(3, '0');
    const lonMin = Math.floor((lonAbs % 1) * 60)
      .toString()
      .padStart(2, '0');

    return `${latPrefix}${latDeg}${latMin}${lonPrefix}${lonDeg}${lonMin}`;
  }

  private isVfrCategory(category?: string): boolean {
    if (!category) return true;
    return VFR_CATEGORIES.has(category.toLowerCase());
  }

  private loadJson<T>(filename: string): T[] {
    const paths = [
      join(__dirname, 'data', filename),
      join(process.cwd(), 'src', 'modules', 'flights', 'data', filename),
    ];

    const filePath = paths.find((candidate) => existsSync(candidate));
    if (!filePath) {
      return [];
    }

    return JSON.parse(readFileSync(filePath, 'utf-8')) as T[];
  }
}
