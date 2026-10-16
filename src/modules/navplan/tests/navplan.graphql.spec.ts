import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { validationPipeOptions } from '../../../config/validation.config';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import GraphQLJSON from 'graphql-type-json';
import * as request from 'supertest';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import {
  NavdataService,
  toAirspaceRecord,
} from '../../navdata/navdata.service';
import { NavdataResolver } from '../../navdata/navdata.resolver';
import { buildBundle } from '../../navdata/import/bundle';
import { siaSampleBuffer } from '../../navdata/import/tests/fixtures/sia-sample';
import { AircraftDataService } from '../../aircraft/flight-data/aircraft-data.service';
import { AircraftDataResolver } from '../../aircraft/flight-data/aircraft-data.resolver';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import {
  AircraftMassBalanceEntity,
  AircraftPerformanceEntity,
} from '../../aircraft/entity/aircraft-flight-data.entity';
import { FlightsService } from '../../flights/flights.service';
import { Reservation } from '../../reservations/entity/reservations.entity';
import { NavplanService } from '../navplan.service';
import { NavplanResolver } from '../navplan.resolver';
import { FlightPlanEntity } from '../entity/flight-plan.entity';
import { FlightPlanningSettingsEntity } from '../entity/flight-planning-settings.entity';
import { MetarTafService } from '../weather/metar-taf.service';
import { WindsAloftService } from '../weather/winds-aloft.service';
import {
  GRID_SCHEMA,
  GRID_VARIABLES,
  quantize,
  WindsGrid,
} from '../weather/winds-grid';
import { EnginePoint } from '../engine/engine';
import { inverse } from '../engine/geodesy';
import { templateByCode } from '../../aircraft/flight-data/aircraft-templates';

// End to end through GraphQL: a DR400-140B from the template, confirmed by
// an administrator with its weighing, flies LFPN -> VRP NW -> LFOP over the
// SIA sample data, with a forecast wind of 270/20 kt and a METAR QNH.
// Database, METAR server and flights are stand-ins; everything else (engine,
// services, resolvers, validation, translations) is the real code.

type Row = Record<string, any>;
const repository = (key: string, rows: Row[] = []) => ({
  rows,
  create: (value: Row) => ({ ...value }),
  findOne: async ({ where }: { where: Row }) =>
    rows.find((row) => Object.entries(where).every(([k, v]) => row[k] === v)) ??
    null,
  find: async () => rows,
  save: async (value: Row) => {
    const now = new Date();
    if (key === 'id' && value.id == null) value.id = rows.length + 1;
    const existing = rows.find((row) => row[key] === value[key]);
    const saved = Object.assign(existing ?? {}, value, {
      updated_at: now,
      created_at: existing?.created_at ?? now,
    });
    if (!existing) rows.push(saved);
    return saved;
  },
  update: async (where: Row, values: Row) => {
    for (const row of rows) {
      if (Object.entries(where).every(([k, v]) => row[k] === v))
        Object.assign(row, values);
    }
  },
});

const DEPARTURE = new Date('2026-10-17T08:00:00Z');

// Wind from 270° at 20 kt everywhere, 10 °C, valid 06Z-18Z.
const windGrid = (): WindsGrid => {
  const header = {
    schema: GRID_SCHEMA,
    model: 'ICON-EU',
    run: '2026-10-17T06:00:00.000Z',
    steps: [0, 12],
    levels: [1000, 925, 850, 700],
    lat0: 47,
    lon0: 0,
    dLat: 0.5,
    dLon: 0.5,
    nLat: 7,
    nLon: 7,
    createdAt: '2026-10-17T06:00:00Z',
    attribution: 'DWD ICON-EU CC BY 4.0',
  };
  const size =
    header.steps.length * header.levels.length * GRID_VARIABLES.length * 49;
  const data = new Int16Array(size);
  const eastward = (20 * 1852) / 3600;
  for (let i = 0; i < size; i++) {
    const variable = Math.floor(i / 49) % 3;
    data[i] = quantize(
      GRID_VARIABLES[variable],
      variable === 0 ? eastward : variable === 1 ? 0 : 283.15,
    );
  }
  return { header, data };
};

class InMemoryNavdata {
  points: EnginePoint[];
  airspaces: ReturnType<typeof toAirspaceRecord>[];
  constructor() {
    const { bundle } = buildBundle({
      sia: { fileName: 'XML_SIA_2026-10-29.xml', data: siaSampleBuffer() },
      now: new Date('2026-10-16'),
    });
    this.points = bundle.points.map((p) => ({
      id: randomUUID(),
      type: p.type,
      ident: p.ident,
      name: p.name,
      lat: p.lat,
      lon: p.lon,
      elevationFt: p.elevationFt,
      frequency: p.frequency,
      aerodromeIcao: p.aerodromeIcao,
      mandatory: p.mandatory,
    }));
    this.airspaces = bundle.airspaces.map((a) => {
      const ring = a.geometry[0][0];
      return {
        ...a,
        id: randomUUID(),
        minLat: Math.min(...ring.map((p) => p[1])),
        maxLat: Math.max(...ring.map((p) => p[1])),
        minLon: Math.min(...ring.map((p) => p[0])),
        maxLon: Math.max(...ring.map((p) => p[0])),
      };
    });
  }
  cycle = {
    id: 1,
    airac: '2611',
    effective_from: new Date('2026-10-29T00:00:00Z'),
    effective_to: new Date('2026-11-26T00:00:00Z'),
    source: "Service de l'Information Aéronautique – mise à jour du 2026-10-29",
    has_sia: true,
  };
  async activeCycle() {
    return this.cycle;
  }
  status(cycle: any, now = new Date()) {
    return NavdataService.prototype.status.call(this, cycle, now);
  }
  async info() {
    return NavdataService.prototype.info.call(
      this,
      new Date('2026-11-02T00:00:00Z'),
    );
  }
  async pointById(id: string) {
    return this.points.find((p) => p.id === id) ?? null;
  }
  async allAirspaces() {
    return this.airspaces;
  }
  async airspacesInBox(box: any) {
    return this.airspaces.filter(
      (a) =>
        a.maxLat >= box.south &&
        a.minLat <= box.north &&
        a.maxLon >= box.west &&
        a.minLon <= box.east,
    );
  }
  async aerodrome(icao: string) {
    const point = this.points.find(
      (p) => p.type === 'AERODROME' && p.ident === icao,
    );
    return point
      ? { point, runways: [], frequencies: [], circuitHeightFt: null }
      : null;
  }
  async search(text: string) {
    return this.points.filter(
      (p) =>
        p.ident.includes(text.toUpperCase()) ||
        p.aerodromeIcao === text.toUpperCase(),
    );
  }
  ident(ident: string) {
    return this.points.find((p) => p.ident === ident);
  }
}

describe('Flight preparation through GraphQL (LFPN -> LFOP, DR400-140B)', () => {
  let app: INestApplication;
  const navdata = new InMemoryNavdata();
  const plans = repository('id');
  const flights = {
    bookingForNewFlight: jest.fn(async (id: number | null) =>
      id === 7
        ? {
            id: 7,
            user: { id: 2 },
            aircraft: { id: 1 },
            flight_category: 'Navigation',
            number_of_passengers: 1,
          }
        : null,
    ),
    // (input, requester, language), like FlightsService.createFlightByUser.
    createFlightByUser: jest.fn(async (...args: [Row, Row?, string?]) => ({
      id: 31,
      ...args[0],
    })),
    updateFlight: jest.fn(async (id: number, input: Row) => ({ id, ...input })),
    canReadFlightsOf: jest.fn(
      async (pilotId: number, requester: any) =>
        requester.role === 'Administrateur' ||
        Number(pilotId) === Number(requester.id),
    ),
  };
  const users: Record<string, any> = {
    admin: { id: 1, email: 'admin@example.com', role: 'Administrateur' },
    pilot: { id: 2, email: 'pilot@example.com', role: 'Pilote' },
    other: { id: 3, email: 'other@example.com', role: 'Pilote' },
  };

  const gql = async (
    who: string,
    query: string,
    variables: Row = {},
    language = 'fr',
  ) =>
    (
      await request(app.getHttpServer())
        .post('/graphql')
        .set('x-test-user', who)
        .set('Accept-Language', language)
        .send({ query, variables })
    ).body;

  beforeAll(async () => {
    const winds = new WindsAloftService();
    winds.use(windGrid());
    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          resolvers: { JSON: GraphQLJSON },
          context: ({ req }: { req: any }) => ({ req }),
        }),
      ],
      providers: [
        NavdataResolver,
        NavplanResolver,
        AircraftDataResolver,
        NavplanService,
        AircraftDataService,
        { provide: NavdataService, useValue: navdata },
        { provide: WindsAloftService, useValue: winds },
        {
          provide: MetarTafService,
          useValue: {
            qnhOf: async () => 1021,
            metarsInBox: async () => [],
            reports: async (icaos: string[]) =>
              icaos.map((icao) => ({
                icao,
                metar: `METAR ${icao} 170730Z 27012KT CAVOK 14/09 Q1021`,
                taf: `TAF ${icao} 170500Z 1706/1715 27012KT CAVOK`,
                observedAt: new Date('2026-10-17T07:30:00Z'),
              })),
          },
        },
        { provide: FlightsService, useValue: flights },
        {
          provide: getRepositoryToken(Aircraft),
          useValue: repository('id', [
            {
              id: 1,
              registration_number: 'F-GAER',
              model: 'Robin DR400-140B',
              fuel_capacity: 110,
            },
          ]),
        },
        {
          provide: getRepositoryToken(AircraftPerformanceEntity),
          useValue: repository('aircraft_id'),
        },
        {
          provide: getRepositoryToken(AircraftMassBalanceEntity),
          useValue: repository('aircraft_id'),
        },
        { provide: getRepositoryToken(FlightPlanEntity), useValue: plans },
        {
          provide: getRepositoryToken(FlightPlanningSettingsEntity),
          useValue: repository('id'),
        },
        {
          provide: getRepositoryToken(Reservation),
          useValue: repository('id', [{ id: 7, instructor: null }]),
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.getArgs()[2]?.req;
          req.user = users[req.headers['x-test-user']];
          return !!req.user;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    // As in main.ts.
    app.useGlobalPipes(new ValidationPipe(validationPipeOptions));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const COMPUTE = `query ($input: FlightPlanInput!) {
    computeFlightPlan(input: $input) {
      status totalDistanceNm totalTimeMin windSource engineVersion encodedPolyline
      navdata { airac stale source }
      notices { code status message }
      legs {
        index from { ident type } to { ident type } distanceNm trueCourseDeg variationDeg magneticCourseDeg
        wind { directionDeg speedKt source temperatureC }
        windCorrectionDeg trueHeadingDeg magneticHeadingDeg tasKt groundSpeedKt altitudeFt suggestedAltitudeFt
        segments { phase fromNm toNm startAltFt endAltFt timeMin fuelL gsKt }
        timeMin cumulativeTimeMin eta fuelL fuelRemainingL
        crossings { airspace { name type floor { label } ceiling { label } } entryNm exitNm relation status requirement activityKnown }
      }
      profile { distanceNm altitudeFt label }
      fuel { taxiL tripL finalReserveL finalReserveMin minimumBlockL loadedL extraL landingL usableL enduranceMin status messages }
      massBalance { status messages lines { stationId label massKg armM momentKgm } takeoff { massKg cgM withinEnvelope marginKg marginCgMm } landing { massKg cgM withinEnvelope } envelope { category points { armM massKg } } }
      weather { icao metar taf }
    }
  }`;

  const planInput = () => ({
    aircraftId: 1,
    reservationId: 7,
    departureTime: DEPARTURE.toISOString(),
    departure: { navPointId: navdata.ident('LFPN').id },
    destination: { navPointId: navdata.ident('LFOP').id },
    waypoints: [{ navPointId: navdata.ident('NW').id }],
    legs: [{ altitudeFt: 2500 }, { altitudeFt: 2500 }],
    reserveCase: 'VFR_DAY',
    qnhHpa: null,
    loads: [
      { stationId: 'front', massKg: 160 },
      { stationId: 'baggage', massKg: 10 },
    ],
    fuel: [{ tankId: 'main', liters: 100 }],
    envelopeCategory: 'NORMAL',
  });

  let template: ReturnType<typeof templateByCode>;

  it('an administrator applies the DR400-140B template; a pilot cannot', async () => {
    const mutation = `mutation { applyAircraftTemplate(aircraftId: 1, templateCode: "DR400-140B") { templateCode source validatedAt cruise { normalSetting } fuel { tanks { id usableL } } } }`;
    expect((await gql('pilot', mutation)).errors[0].extensions.code).toBe(
      'FORBIDDEN',
    );
    const { data } = await gql('admin', mutation);
    expect(data.applyAircraftTemplate).toMatchObject({
      templateCode: 'DR400-140B',
      validatedAt: null,
      cruise: { normalSetting: '75%' },
      fuel: { tanks: [{ id: 'main', usableL: 109 }] },
    });
    expect(data.applyAircraftTemplate.source).toMatch(/Modèle à vérifier/);
    template = templateByCode('DR400-140B');
  });

  it('refuses mass and balance while the aircraft data is not confirmed', async () => {
    const { data } = await gql('pilot', COMPUTE, { input: planInput() });
    const plan = data.computeFlightPlan;
    expect(plan.status).toBe('BLOCKING');
    expect(plan.massBalance.status).toBe('BLOCKING');
    expect(plan.massBalance.lines).toEqual([]);
    expect(plan.massBalance.messages[0]).toMatch(
      /ne sont pas confirmées par un administrateur/,
    );
    expect(plan.notices.map((n: any) => n.code)).toEqual(
      expect.arrayContaining(['MB_NOT_VALIDATED', 'PERF_NOT_VALIDATED']),
    );
  });

  it('refuses to confirm an aircraft without its weighing', async () => {
    const body = await gql(
      'admin',
      'mutation { validateAircraftData(aircraftId: 1) }',
    );
    expect(body.errors[0].message).toMatch(/pesée|weighing/);
  });

  it('the administrator enters the weighing and confirms; the pilot cannot confirm', async () => {
    const mb = template.massBalance;
    const save = await gql(
      'admin',
      `mutation ($input: AircraftMassBalanceInput!) { saveAircraftMassBalance(aircraftId: 1, input: $input) { emptyMassKg mtowKg validatedAt envelopes { category } } }`,
      {
        input: {
          emptyMassKg: 590,
          emptyArmM: 0.36,
          weighingDate: '2026-03-01T00:00:00Z',
          weighingRef: 'Pesée test',
          mtowKg: mb.mtowKg,
          mlwKg: mb.mlwKg,
          stations: mb.stations.map(
            ({ id, label, kind, armM, maxKg, tankId }) => ({
              id,
              label,
              kind,
              armM,
              maxKg: maxKg ?? null,
              tankId: tankId ?? null,
            }),
          ),
          combinedLimits: [],
          envelopes: mb.envelopes,
        },
      },
    );
    expect(save.data.saveAircraftMassBalance).toMatchObject({
      emptyMassKg: 590,
      mtowKg: 1000,
      validatedAt: null,
    });
    expect(
      (await gql('pilot', 'mutation { validateAircraftData(aircraftId: 1) }'))
        .errors[0].extensions.code,
    ).toBe('FORBIDDEN');
    expect(
      (await gql('admin', 'mutation { validateAircraftData(aircraftId: 1) }'))
        .data.validateAircraftData,
    ).toBe(true);
  });

  it('refuses an envelope that is not a simple polygon', async () => {
    const body = await gql(
      'admin',
      `mutation ($input: AircraftMassBalanceInput!) { saveAircraftMassBalance(aircraftId: 1, input: $input) { emptyMassKg } }`,
      {
        input: {
          emptyMassKg: 590,
          emptyArmM: 0.36,
          weighingDate: '2026-03-01T00:00:00Z',
          mtowKg: 1000,
          mlwKg: 1000,
          stations: [],
          combinedLimits: [],
          envelopes: [
            {
              category: 'NORMAL',
              points: [
                { armM: 0.2, massKg: 500 },
                { armM: 0.5, massKg: 1000 },
                { armM: 0.5, massKg: 500 },
                { armM: 0.2, massKg: 1000 },
              ],
            },
          ],
        },
      },
      'en',
    );
    expect(body.errors[0].message).toMatch(
      /^Invalid mass and balance data: NORMAL: the envelope must be a simple polygon/,
    );
  });

  it('computes the full plan LFPN -> NW -> LFOP', async () => {
    const { data, errors } = await gql('pilot', COMPUTE, {
      input: planInput(),
    });
    expect(errors).toBeUndefined();
    const plan = data.computeFlightPlan;

    // Route geometry (WGS84 geodesics) and magnetic variation (WMM2025).
    const [leg1, leg2] = plan.legs;
    expect(leg1.from.ident).toBe('LFPN');
    expect(leg1.to).toEqual({ ident: 'NW', type: 'VRP' });
    expect(leg2.to.ident).toBe('LFOP');
    const lfpn = navdata.ident('LFPN');
    const nw = navdata.ident('NW');
    const lfop = navdata.ident('LFOP');
    expect(leg1.distanceNm).toBeCloseTo(inverse(lfpn, nw).distanceNm, 6);
    expect(leg2.distanceNm).toBeCloseTo(inverse(nw, lfop).distanceNm, 6);
    expect(plan.totalDistanceNm).toBeCloseTo(
      leg1.distanceNm + leg2.distanceNm,
      6,
    );
    for (const leg of plan.legs) {
      expect(leg.variationDeg).toBeGreaterThan(1.5);
      expect(leg.variationDeg).toBeLessThan(2.3);
      expect(leg.magneticCourseDeg).toBeCloseTo(
        (leg.trueCourseDeg - leg.variationDeg + 360) % 360,
        6,
      );
      expect(leg.wind).toMatchObject({
        directionDeg: 270,
        speedKt: 20,
        source: 'MODEL',
      });
      // Wind triangle: GS = TAS cos(WCA) - headwind.
      const theta = ((270 - leg.trueCourseDeg) * Math.PI) / 180;
      const expectedGs =
        leg.tasKt * Math.cos((leg.windCorrectionDeg * Math.PI) / 180) -
        20 * Math.cos(theta);
      // The grid stores the wind to 0.01 m/s; the API shows it rounded.
      expect(leg.groundSpeedKt).toBeCloseTo(expectedGs, 1);
      expect(leg.altitudeFt).toBe(2500);
    }
    // Climb from LFPN (538 ft) on the first leg, descent to the LFOP circuit
    // (512 + 1000 ft) on the last.
    expect(leg1.segments[0]).toMatchObject({ phase: 'CLIMB', startAltFt: 538 });
    expect(leg2.segments[leg2.segments.length - 1]).toMatchObject({
      phase: 'DESCENT',
      endAltFt: 1512,
    });
    expect(plan.profile.map((p: any) => p.label)).toEqual(
      expect.arrayContaining(['TOC', 'TOD']),
    );
    expect(plan.totalTimeMin).toBeCloseTo(leg1.timeMin + leg2.timeMin, 6);
    expect(leg2.fuelRemainingL).toBeCloseTo(
      100 - 3 - leg1.fuelL - leg2.fuelL,
      6,
    );

    // Fuel: VFR day reserve 30 min at the holding flow of the template.
    expect(plan.fuel.finalReserveMin).toBe(30);
    expect(plan.fuel.finalReserveL).toBeCloseTo(
      (30 / 60) * template.performance.reserve.holdingFuelFlowLph,
      6,
    );
    expect(plan.fuel.minimumBlockL).toBeCloseTo(
      3 + plan.fuel.tripL + plan.fuel.finalReserveL,
      6,
    );
    expect(plan.fuel.status).toBe('OK');

    // Mass and balance: empty 590 kg at 0.36 m, front 160, baggage 10, 97 L.
    expect(plan.massBalance.status).toBe('OK');
    const takeoffFuelKg = 97 * 0.72;
    const mass = 590 + 160 + 10 + takeoffFuelKg;
    const moment = 590 * 0.36 + 160 * 0.41 + 10 * 1.9 + takeoffFuelKg * 1.12;
    expect(plan.massBalance.takeoff.massKg).toBeCloseTo(mass, 6);
    expect(plan.massBalance.takeoff.cgM).toBeCloseTo(moment / mass, 6);
    expect(plan.massBalance.takeoff.withinEnvelope).toBe(true);
    expect(plan.massBalance.landing.massKg).toBeCloseTo(
      mass - plan.fuel.tripL * 0.72,
      6,
    );

    // Airspaces of the SIA sample along the route.
    const crossed = plan.legs.flatMap((leg: any) => leg.crossings);
    const byName = (name: string) =>
      crossed.find((c: any) => c.airspace.name.startsWith(name));
    expect(byName('CTR TOUSSUS')).toMatchObject({
      relation: 'INSIDE',
      status: 'WARNING',
    });
    expect(byName('CTR TOUSSUS').requirement).toBe(
      'Clairance requise — contacter TOUSSUS Tour 119.300.',
    );
    expect(byName('TMA TEST')).toMatchObject({
      relation: 'INSIDE',
      airspace: {
        floor: { label: '1500 ft AMSL' },
        ceiling: { label: 'FL065' },
      },
    });
    expect(byName('R 999')).toMatchObject({
      relation: 'UNKNOWN_VERTICAL',
      status: 'WARNING',
      activityKnown: false,
    });
    expect(byName('PRN 001')).toMatchObject({ relation: 'UNKNOWN_VERTICAL' });
    expect(byName('SIV TEST')).toMatchObject({
      relation: 'INSIDE',
      status: 'OK',
    });
    expect(byName('P 99')).toBeUndefined();

    // Data age and sources.
    expect(plan.navdata).toMatchObject({ airac: '2611', stale: false });
    expect(plan.windSource).toMatch(/^DWD ICON-EU run 2026-10-17 06Z/);
    expect(plan.notices.map((n: any) => n.code)).toEqual(
      expect.arrayContaining(['DISCLAIMER', 'NOTAM_CHECK']),
    );
    expect(plan.notices.map((n: any) => n.code)).not.toContain('QNH_DEFAULTED');
    expect(plan.status).toBe('WARNING');
  });

  it('answers in English when the interface is in English', async () => {
    const { data } = await gql('pilot', COMPUTE, { input: planInput() }, 'en');
    const disclaimer = data.computeFlightPlan.notices.find(
      (n: any) => n.code === 'DISCLAIMER',
    );
    expect(disclaimer.message).toMatch(/^Flight preparation aid/);
  });

  it('flags an overloaded aircraft and too little fuel', async () => {
    const input = {
      ...planInput(),
      loads: [
        { stationId: 'front', massKg: 170 },
        { stationId: 'rear', massKg: 160 },
        { stationId: 'baggage', massKg: 70 },
      ],
      fuel: [{ tankId: 'main', liters: 20 }],
    };
    const plan = (await gql('pilot', COMPUTE, { input })).data
      .computeFlightPlan;
    expect(plan.status).toBe('BLOCKING');
    expect(plan.massBalance.messages).toEqual(
      expect.arrayContaining(['Bagages / Baggage : 70 kg > 60 kg']),
    );
    expect(plan.fuel.status).toBe('BLOCKING');
    expect(plan.fuel.messages[0]).toMatch(/^Carburant insuffisant/);
  });

  it('refuses legs that do not match the waypoints', async () => {
    const body = await gql('pilot', COMPUTE, {
      input: { ...planInput(), legs: [{ altitudeFt: 2500 }] },
    });
    expect(body.errors[0].message).toBe(
      'Il faut une branche de plus que de points tournants (2 attendues)',
    );
  });

  let planId: number;

  it('saves the plan on the booking, with the columns the existing screens read', async () => {
    const { data, errors } = await gql(
      'pilot',
      `mutation ($input: FlightPlanInput!) { saveFlightPlan(input: $input) { id flightId input result { status legs { distanceNm } } } }`,
      { input: planInput() },
    );
    expect(errors).toBeUndefined();
    planId = data.saveFlightPlan.id;
    expect(data.saveFlightPlan.flightId).toBe(31);
    const [legacy, requester] = flights.createFlightByUser.mock.calls[0];
    expect(requester).toMatchObject({ id: 2 });
    expect(legacy).toMatchObject({
      reservation_id: 7,
      user_id: 2,
      origin_icao: 'LFPN',
      destination_icao: 'LFOP',
      plan_engine: 'navplan-1',
    });
    // The leg ending at a point is stored on that point (no shifted legs).
    expect(legacy.waypoints[1].leg_distance_nm).toBeCloseTo(
      data.saveFlightPlan.result.legs[0].distanceNm,
      1,
    );
    expect(legacy.waypoints[2].leg_distance_nm).toBeCloseTo(
      data.saveFlightPlan.result.legs[1].distanceNm,
      1,
    );
    // Planned hours are not rounded up to the hour any more.
    expect(legacy.flight_hours).toBeLessThan(1);
  });

  it('refuses a plan on an aircraft other than the booked one', async () => {
    flights.bookingForNewFlight.mockResolvedValueOnce({
      id: 7,
      user: { id: 2 },
      aircraft: { id: 9 },
    } as any);
    const body = await gql(
      'pilot',
      `mutation ($input: FlightPlanInput!) { saveFlightPlan(input: $input) { id } }`,
      { input: planInput() },
    );
    expect(body.errors[0].message).toBe(
      "L'avion du plan doit être celui de la réservation",
    );
  });

  it('lets the pilot and an administrator read the plan, not another member', async () => {
    const query = `query { flightPlan(id: ${planId}) { id result { totalDistanceNm } } }`;
    expect((await gql('pilot', query)).data.flightPlan.id).toBe(planId);
    expect((await gql('admin', query)).data.flightPlan.id).toBe(planId);
    expect((await gql('other', query)).errors[0].message).toBe(
      'Vous ne pouvez consulter ou modifier que vos propres plans de vol',
    );
    const update = await gql(
      'other',
      `mutation ($input: FlightPlanInput!) { saveFlightPlan(input: $input, flightPlanId: ${planId}) { id } }`,
      { input: planInput() },
    );
    expect(update.errors[0].extensions.code).toBe('FORBIDDEN');
  });

  it('prints the flight file in A4 and the kneeboard log in A5', async () => {
    for (const format of ['A4', 'A5']) {
      const { data, errors } = await gql(
        'pilot',
        `mutation { exportFlightPlanPdf(flightPlanId: ${planId}, format: ${format}) }`,
      );
      expect(errors).toBeUndefined();
      const pdf = Buffer.from(data.exportFlightPlanPdf, 'base64');
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.length).toBeGreaterThan(3000);
    }
  });

  it('keeps the club reserves at or above the AMC minima', async () => {
    const mutation = `mutation ($input: FlightPlanningSettingsInput!) { saveFlightPlanningSettings(input: $input) { reserveVfrDayMin contingencyPercent } }`;
    const input = {
      reserveVfrDayLocalMin: 10,
      reserveVfrDayMin: 20,
      reserveVfrNightMin: 45,
      contingencyPercent: 10,
      contingencyMinL: 0,
      alternateRequiredVfr: false,
      clubMarginMin: 0,
      verticalMarginFt: 300,
      defaultCircuitHeightFt: 1000,
    };
    expect((await gql('admin', mutation, { input })).errors[0].message).toBe(
      'La réserve finale VFR_DAY ne peut pas être inférieure à 30 min (AMC1 NCO.OP.125(b))',
    );
    expect(
      (
        await gql('pilot', mutation, {
          input: { ...input, reserveVfrDayMin: 30 },
        })
      ).errors[0].extensions.code,
    ).toBe('FORBIDDEN');
    const saved = await gql('admin', mutation, {
      input: { ...input, reserveVfrDayMin: 40 },
    });
    expect(saved.data.saveFlightPlanningSettings).toEqual({
      reserveVfrDayMin: 40,
      contingencyPercent: 10,
    });
    const plan = (await gql('pilot', COMPUTE, { input: planInput() })).data
      .computeFlightPlan;
    expect(plan.fuel.finalReserveMin).toBe(40);
  });

  it('serves the navigation data: info, search and airspaces with their labels', async () => {
    const { data } = await gql(
      'pilot',
      `query { navdataInfo { airac stale } navSearch(query: "NW") { ident type aerodromeIcao mandatory } airspacesInBox(bbox: { south: 48.6, west: 1.6, north: 49.2, east: 2.5 }) { name type floor { ref value label } ceiling { label } geometry } }`,
    );
    expect(data.navdataInfo).toEqual({ airac: '2611', stale: false });
    expect(data.navSearch).toEqual([
      { ident: 'NW', type: 'VRP', aerodromeIcao: 'LFPN', mandatory: true },
    ]);
    const tma = data.airspacesInBox.find((a: any) => a.name === 'TMA TEST 1');
    expect(tma.floor).toEqual({
      ref: 'AMSL',
      value: 1500,
      label: '1500 ft AMSL',
    });
    expect(tma.geometry.type).toBe('MultiPolygon');
  });
});
