import * as polyline from 'polyline';
import { FlightPlanGeneratorService } from '../flight-plan-generator.service';
import { AirwayGraphService } from '../airway-graph.service';
import { AirportData } from '../interfaces/airport.interface';

describe('FlightPlanGeneratorService', () => {
  let service: FlightPlanGeneratorService;

  const lfpg: AirportData = {
    icao: 'LFPG',
    iata: 'CDG',
    name: 'Paris Charles de Gaulle Airport',
    city: 'Paris',
    country: 'FR',
    lat: 49.0097,
    lon: 2.5479,
    elevation_ft: 392,
    type: 'large_airport',
    continent: 'EU',
    runways: ['09L/27R', '09R/27L', '08L/26R', '08R/26L'],
    runway_details: [
      { le_ident: '09L', he_ident: '27R', length_ft: 13829, width_ft: 148, surface: 'ASP', lighted: true },
      { le_ident: '09R', he_ident: '27L', length_ft: 8858, width_ft: 197, surface: 'ASP', lighted: true },
    ],
    frequencies: [
      { type: 'TWR', value: '119.250' },
      { type: 'ATIS', value: '127.250' },
      { type: 'GND', value: '121.600' },
      { type: 'APP', value: '126.430' },
    ],
  };

  const lfpb: AirportData = {
    icao: 'LFPB',
    iata: 'LBG',
    name: 'Paris-Le Bourget Airport',
    city: 'Paris',
    country: 'FR',
    lat: 48.9694,
    lon: 2.44139,
    elevation_ft: 218,
    type: 'medium_airport',
    continent: 'EU',
    runways: ['07/25', '03/21'],
    runway_details: [
      { le_ident: '07', he_ident: '25', length_ft: 9843, width_ft: 148, surface: 'ASP', lighted: true },
    ],
    frequencies: [
      { type: 'TWR', value: '120.900' },
      { type: 'ATIS', value: '128.000' },
    ],
  };

  const lfbo: AirportData = {
    icao: 'LFBO',
    iata: 'TLS',
    name: 'Toulouse-Blagnac Airport',
    city: 'Toulouse',
    country: 'FR',
    lat: 43.6291,
    lon: 1.36382,
    elevation_ft: 499,
    type: 'large_airport',
    continent: 'EU',
    runways: ['14L/32R', '14R/32L'],
    runway_details: [
      { le_ident: '14L', he_ident: '32R', length_ft: 11483, width_ft: 148, surface: 'ASP', lighted: true },
      { le_ident: '14R', he_ident: '32L', length_ft: 9842, width_ft: 148, surface: 'ASP', lighted: true },
    ],
    frequencies: [
      { type: 'TWR', value: '118.100' },
      { type: 'ATIS', value: '123.475' },
      { type: 'GND', value: '121.875' },
    ],
  };

  const kjfk: AirportData = {
    icao: 'KJFK',
    iata: 'JFK',
    name: 'John F Kennedy International Airport',
    city: 'New York',
    country: 'US',
    lat: 40.6398,
    lon: -73.7789,
    elevation_ft: 13,
    type: 'large_airport',
    continent: 'NA',
    runways: ['04L/22R', '04R/22L', '13L/31R', '13R/31L'],
    runway_details: [
      { le_ident: '04L', he_ident: '22R', length_ft: 12079, width_ft: 200, surface: 'ASP', lighted: true },
    ],
    frequencies: [
      { type: 'TWR', value: '119.100' },
      { type: 'ATIS', value: '128.725' },
    ],
  };

  beforeEach(() => {
    const airwayGraph = new AirwayGraphService();
    airwayGraph.onModuleInit();
    service = new FlightPlanGeneratorService(airwayGraph);
    service.onModuleInit();
  });

  /* ================================================================ */
  /*  Waypoint sequence structure                                     */
  /* ================================================================ */

  it('generates waypoints in correct phase sequence: APT SID TOC FIX... TOD STAR APP APT', () => {
    const plan = service.generateFlightPlan(lfpg, lfbo, 500, 30000);
    const types = plan.waypoints.map((wp) => wp.type);

    // First must be APT (departure)
    expect(types[0]).toBe('APT');
    // Second must be SID
    expect(types[1]).toBe('SID');
    // Must have a TOC
    expect(types).toContain('TOC');
    // Must have a TOD
    expect(types).toContain('TOD');
    // Must have STAR before APP
    const starIdx = types.indexOf('STAR');
    const appIdx = types.indexOf('APP');
    expect(starIdx).toBeGreaterThan(-1);
    expect(appIdx).toBeGreaterThan(starIdx);
    // Last must be APT (arrival)
    expect(types[types.length - 1]).toBe('APT');

    // Overall order: APT < SID < TOC < TOD < STAR < APP < APT
    const tocIdx = types.indexOf('TOC');
    const todIdx = types.indexOf('TOD');
    expect(tocIdx).toBeGreaterThan(1); // after SID
    expect(todIdx).toBeGreaterThan(tocIdx);
    expect(starIdx).toBeGreaterThan(todIdx);
  });

  it('departure APT has DEPARTURE phase and speed 0', () => {
    const plan = service.generateFlightPlan(lfpg, lfbo, 500, 30000);
    expect(plan.waypoints[0].phase).toBe('DEPARTURE');
    expect(plan.waypoints[0].speed_kts).toBe(0);
  });

  it('arrival APT has LANDING phase', () => {
    const plan = service.generateFlightPlan(lfpg, lfbo, 500, 30000);
    const last = plan.waypoints.at(-1);
    expect(last?.phase).toBe('LANDING');
    expect(last?.speed_kts).toBeGreaterThan(0);
  });

  it('SID waypoint has INITIAL_CLIMB phase', () => {
    const plan = service.generateFlightPlan(lfpg, lfbo, 500, 30000);
    const sid = plan.waypoints.find((wp) => wp.type === 'SID');
    expect(sid?.phase).toBe('INITIAL_CLIMB');
    expect(sid?.speed_kts).toBeGreaterThan(0);
  });

  it('STAR and APP waypoints exist with correct phases', () => {
    const plan = service.generateFlightPlan(lfpg, lfbo, 500, 30000);
    const star = plan.waypoints.find((wp) => wp.type === 'STAR');
    const app = plan.waypoints.find((wp) => wp.type === 'APP');

    expect(star?.phase).toBe('APPROACH');
    expect(app?.phase).toBe('FINAL');
    expect(star?.alt).toBeGreaterThan(lfbo.elevation_ft!);
    expect(app?.alt).toBeGreaterThan(lfbo.elevation_ft!);
    expect(app?.alt).toBeLessThan(star!.alt);
  });

  /* ================================================================ */
  /*  Airport info: runways, frequencies, METAR                       */
  /* ================================================================ */

  it('includes real runway and frequency data on APT waypoints', () => {
    const plan = service.generateFlightPlan(lfbo, lfpg, 500, 30000);
    const depName = plan.waypoints[0].name;
    const arrName = plan.waypoints.at(-1)!.name;

    // Should have TWR frequency, not N/A
    expect(depName).toContain('TWR 118.100');
    expect(depName).toContain('ATIS 123.475');
    expect(arrName).toContain('TWR 119.250');
    expect(arrName).toContain('ATIS 127.250');

    // RWY should not be N/A
    expect(depName).toContain('RWY');
    expect(depName).not.toContain('RWY N/A');
    expect(arrName).toContain('RWY');
    expect(arrName).not.toContain('RWY N/A');
  });

  it('includes GND frequency when available', () => {
    const plan = service.generateFlightPlan(lfpg, lfbo, 500, 30000);
    expect(plan.waypoints[0].name).toContain('GND 121.600');
    expect(plan.waypoints.at(-1)!.name).toContain('GND 121.875');
  });

  it('includes METAR in APT name when provided via options', () => {
    const metar = {
      icaoId: 'LFPG',
      rawOb: 'METAR LFPG 011230Z 09012KT 9999 FEW030',
      temp: 15,
      dewp: 8,
      wdir: 90,
      wspd: 12,
      wgst: null,
      visib: 10,
      altim: 1013,
      fltcat: 'VFR',
      clouds: [{ cover: 'FEW', base: 3000 }],
    };

    const plan = service.generateFlightPlan(
      lfpg,
      lfbo,
      500,
      30000,
      undefined,
      undefined,
      { metar_departure: metar },
    );
    expect(plan.waypoints[0].name).toContain('METAR METAR LFPG 011230Z');
  });

  /* ================================================================ */
  /*  Runway selection                                                */
  /* ================================================================ */

  it('returns departure_runway and arrival_runway in result', () => {
    const plan = service.generateFlightPlan(lfpg, lfbo, 500, 30000);
    expect(plan.departure_runway).toBeDefined();
    expect(plan.arrival_runway).toBeDefined();
  });

  it('uses preferred runway when specified', () => {
    const plan = service.generateFlightPlan(
      lfpg,
      lfbo,
      500,
      30000,
      undefined,
      undefined,
      { preferred_runway_dep: '27R', preferred_runway_arr: '32L' },
    );
    expect(plan.departure_runway).toBe('27R');
    expect(plan.arrival_runway).toBe('32L');

    const sid = plan.waypoints.find((wp) => wp.type === 'SID');
    expect(sid?.ident).toContain('27R');
  });

  it('selects best runway for wind from METAR', () => {
    const metar = {
      icaoId: 'LFPG',
      rawOb: 'METAR LFPG 09012KT',
      temp: 15,
      dewp: 8,
      wdir: 90,  // wind from 090
      wspd: 12,
      wgst: null,
      visib: 10,
      altim: 1013,
      fltcat: 'VFR',
      clouds: [],
    };

    const plan = service.generateFlightPlan(
      lfpg,
      lfbo,
      500,
      30000,
      undefined,
      undefined,
      { metar_departure: metar },
    );
    // Wind from 090 → best runway should be 09L or 09R
    expect(plan.departure_runway).toMatch(/^09/);
  });

  /* ================================================================ */
  /*  Options overrides                                               */
  /* ================================================================ */

  it('respects cruise_altitude_ft override', () => {
    const plan = service.generateFlightPlan(
      lfpg,
      lfbo,
      500,
      30000,
      undefined,
      undefined,
      { cruise_altitude_ft: 25000 },
    );
    const toc = plan.waypoints.find((wp) => wp.type === 'TOC');
    expect(toc?.alt).toBe(25000);

    // Cruise FIX waypoints should be at cruise altitude
    const cruiseFixes = plan.waypoints.filter(
      (wp) => wp.type === 'FIX' && wp.phase === 'CRUISE',
    );
    for (const fix of cruiseFixes) {
      expect(fix.alt).toBe(25000);
    }
  });

  it('respects flight_rules override', () => {
    // IFR override for a VFR category (tourism)
    const plan = service.generateFlightPlan(
      lfbo,
      lfpg,
      500,
      30000,
      'tourism', // VFR category
      undefined,
      { flight_rules: 'IFR' }, // Force IFR
    );
    const toc = plan.waypoints.find((wp) => wp.type === 'TOC');
    // IFR eastbound: odd thousands → alt % 2000 should be 1000
    expect(toc!.alt % 2000).toBe(1000);
  });

  /* ================================================================ */
  /*  FIX waypoints have heading and speed                            */
  /* ================================================================ */

  it('FIX waypoints include heading_deg and speed_kts', () => {
    const plan = service.generateFlightPlan(lfpg, lfbo, 500, 30000);
    const fixes = plan.waypoints.filter((wp) => wp.type === 'FIX');
    expect(fixes.length).toBeGreaterThanOrEqual(2);

    for (const fix of fixes) {
      expect(fix.heading_deg).toBeDefined();
      expect(fix.heading_deg).toBeGreaterThanOrEqual(0);
      expect(fix.heading_deg).toBeLessThan(360);
      expect(fix.speed_kts).toBeDefined();
      expect(fix.speed_kts).toBeGreaterThan(0);
    }
  });

  /* ================================================================ */
  /*  Existing tests (adapted)                                        */
  /* ================================================================ */

  it('generates a short flight plan with core waypoints', () => {
    const plan = service.generateFlightPlan(lfpg, lfbo, 500, 30000);
    expect(plan.distance_km).toBeGreaterThan(500);
    expect(plan.waypoints[0].ident).toBe('LFPG');
    expect(plan.waypoints.at(-1)?.ident).toBe('LFBO');
  });

  it('generates medium/long flight with multiple FIX waypoints', () => {
    const plan = service.generateFlightPlan(lfpg, kjfk, 900, 39000);
    const fixes = plan.waypoints.filter((wp) => wp.type === 'FIX');
    expect(plan.distance_km).toBeGreaterThan(5000);
    expect(fixes.length).toBeGreaterThanOrEqual(2);
    expect(fixes[0].ident).toMatch(/^([NS]\d{4}[EW]\d{5}|[A-Z0-9]{3,6})$/);
  });

  it('generates route with real navaid identifiers when airway graph is available', () => {
    const plan = service.generateFlightPlan(lfpb, lfbo, 500, 25000);
    const fixes = plan.waypoints.filter((wp) => wp.type === 'FIX');
    // With the airway graph, FIX idents should be short real navaid names
    // (e.g., "BT", "TOU", "LMG") not coordinate-based (e.g., "N4530E00335")
    if (fixes.length > 0) {
      const hasRealNavaid = fixes.some((f) => f.ident.length <= 5 && !/^[NS]\d/.test(f.ident));
      expect(hasRealNavaid).toBe(true);
    }
  });

  it('does not significantly backtrack toward departure for LFBO-LFPG', () => {
    const plan = service.generateFlightPlan(lfbo, lfpg, 500, 30000);
    const fixes = plan.waypoints.filter((wp) => wp.type === 'FIX');
    let bestToArrival = Number.POSITIVE_INFINITY;

    for (const point of fixes) {
      const dist = Math.hypot(point.lat - lfpg.lat, point.lon - lfpg.lon);
      expect(dist).toBeLessThanOrEqual(bestToArrival + 0.2);
      if (dist < bestToArrival) bestToArrival = dist;
    }
  });

  it('applies semicircular rule for cruise altitude', () => {
    const plan = service.generateFlightPlan(lfpg, kjfk, 900, 40000);
    const toc = plan.waypoints.find((wp) => wp.type === 'TOC');
    expect(toc?.alt).toBeDefined();
    expect(toc!.alt % 1000).toBe(500);
  });

  it('applies IFR semicircular rule for cross_country flights', () => {
    const plan = service.generateFlightPlan(
      lfbo,
      lfpg,
      500,
      30000,
      'cross_country',
    );
    const toc = plan.waypoints.find((wp) => wp.type === 'TOC');
    expect(toc!.alt % 2000).toBe(1000);
  });

  it('builds valid altitude profile and polyline', () => {
    const plan = service.generateFlightPlan(lfpg, kjfk, 900, 40000);
    const arrival = plan.waypoints.at(-1);
    expect(arrival?.alt).toBe(kjfk.elevation_ft);

    const decoded = polyline.decode(plan.encoded_polyline);
    expect(decoded.length).toBe(plan.waypoints.length);
  });

  it('computes dynamic TOC/TOD positions', () => {
    const plan = service.generateFlightPlan(lfpg, lfbo, 500, 30000);
    const tocIndex = plan.waypoints.findIndex((wp) => wp.type === 'TOC');
    const todIndex = plan.waypoints.findIndex((wp) => wp.type === 'TOD');
    expect(tocIndex).toBeGreaterThan(0);
    expect(todIndex).toBeLessThan(plan.waypoints.length - 1);
    expect(todIndex).toBeGreaterThan(tocIndex);
  });

  it('TOC and TOD do not overlap with FIX waypoints', () => {
    const plan = service.generateFlightPlan(lfbo, lfpg, 500, 30000);
    const toc = plan.waypoints.find((wp) => wp.type === 'TOC');
    const tod = plan.waypoints.find((wp) => wp.type === 'TOD');
    const fixes = plan.waypoints.filter((wp) => wp.type === 'FIX');

    for (const fix of fixes) {
      // TOC must not be at the same lat/lon as any FIX
      const tocOverlap =
        Math.abs(fix.lat - toc!.lat) < 0.001 &&
        Math.abs(fix.lon - toc!.lon) < 0.001;
      expect(tocOverlap).toBe(false);

      // TOD must not be at the same lat/lon as any FIX
      const todOverlap =
        Math.abs(fix.lat - tod!.lat) < 0.001 &&
        Math.abs(fix.lon - tod!.lon) < 0.001;
      expect(todOverlap).toBe(false);
    }
  });

  it('includes fuel estimation when consumption provided', () => {
    const plan = service.generateFlightPlan(
      lfpg,
      lfbo,
      500,
      30000,
      undefined,
      40,
    );
    expect(plan.estimated_fuel_liters).toBeDefined();
    expect(plan.estimated_fuel_liters).toBeGreaterThan(0);
  });

  it('omits fuel estimation when consumption not provided', () => {
    const plan = service.generateFlightPlan(lfpg, lfbo, 500, 30000);
    expect(plan.estimated_fuel_liters).toBeUndefined();
  });
});
