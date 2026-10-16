import { EntityManager } from 'typeorm';
import { NavdataService } from '../../modules/navdata/navdata.service';
import {
  AirspaceEntity,
  ObstacleEntity,
  NavdataCycle,
  NavPointEntity,
} from '../../modules/navdata/entity/navdata.entity';
import {
  computeFlightPlan,
  EngineInput,
  EnginePoint,
  FlightPlanResult,
} from '../../modules/navplan/engine/engine';
import { FlightPlanningSettingsEntity } from '../../modules/navplan/entity/flight-planning-settings.entity';
import {
  legacyFlightColumns,
  PLAN_ENGINE,
  settingsOf,
} from '../../modules/navplan/navplan.service';
import { DraftBooking } from './model';
import { FleetAircraft } from './fleet';
import { BASE } from './content';

// Saved flight plans of the new engine on real French routes. Turning
// points that are not in the navigation data are entered as the pilot
// would, by their coordinates and a name.
export const ROUTES: Record<
  string,
  { name: string; lat: number; lon: number }[]
> = {
  LFAT: [
    { name: 'Mantes-la-Jolie', lat: 48.991, lon: 1.717 },
    { name: 'Gournay-en-Bray', lat: 49.483, lon: 1.725 },
    { name: 'Abbeville', lat: 50.106, lon: 1.835 },
  ],
  LFOT: [
    { name: 'Châteaudun', lat: 48.07, lon: 1.338 },
    { name: 'Vendôme', lat: 47.793, lon: 1.066 },
  ],
  LFRG: [
    { name: 'Dreux', lat: 48.737, lon: 1.366 },
    { name: 'Bernay', lat: 49.089, lon: 0.598 },
  ],
  LFLD: [
    { name: 'Pithiviers', lat: 48.172, lon: 2.252 },
    { name: 'Gien', lat: 47.687, lon: 2.631 },
  ],
  LFOC: [{ name: 'Angerville', lat: 48.313, lon: 2.003 }],
  LFOP: [
    { name: 'Mantes-la-Jolie', lat: 48.991, lon: 1.717 },
    { name: 'Les Andelys', lat: 49.246, lon: 1.411 },
  ],
};

// Light westerly wind, entered by hand: the demonstration does not depend on
// a winds aloft forecast.
const DEMO_WIND = { directionDeg: 250, speedKt: 12, temperatureC: 8 };

const userPoint = (point: {
  name: string;
  lat: number;
  lon: number;
}): EnginePoint => ({
  id: `USER:${point.lat.toFixed(6)},${point.lon.toFixed(6)}`,
  type: 'USER',
  ident: point.name,
  name: point.name,
  lat: point.lat,
  lon: point.lon,
  elevationFt: null,
  frequency: null,
  aerodromeIcao: null,
  mandatory: null,
});

export interface PlannedFlightPlan {
  booking: DraftBooking;
  input: Record<string, unknown>;
  result: FlightPlanResult;
  legacy: ReturnType<typeof legacyFlightColumns>;
}

// Computes the plans with the engine, as the flight preparation does when a
// pilot saves one. Returns nothing when the installation has no aerodrome
// data yet (the API imports it at start-up).
export const computeShowcasePlans = async (
  manager: EntityManager,
  bookings: DraftBooking[],
  aircraftData: (aircraft: FleetAircraft) => {
    performance: EngineInput['performance'];
    massBalance: EngineInput['massBalance'];
  },
  now: Date,
): Promise<{ plans: PlannedFlightPlan[]; warnings: string[] }> => {
  const warnings: string[] = [];
  const navdata = new NavdataService(
    manager.getRepository(NavdataCycle),
    manager.getRepository(NavPointEntity),
    manager.getRepository(AirspaceEntity),
    manager.getRepository(ObstacleEntity),
  );
  const cycle = await navdata.activeCycle();
  const base = await navdata.aerodromeRow(BASE.icao);
  if (!cycle || !base) {
    return {
      plans: [],
      warnings: [
        `No navigation data (or no ${BASE.icao}): start the API once so that it imports the aerodromes, then the flight plans can be made by hand.`,
      ],
    };
  }
  const settings = settingsOf(
    await manager
      .getRepository(FlightPlanningSettingsEntity)
      .findOne({ where: { id: 1 } }),
  );
  const airspaces = await navdata.allAirspaces();
  const plans: PlannedFlightPlan[] = [];

  for (const booking of bookings) {
    const icao = booking.destination;
    if (!icao) continue;
    const destinationRow = await navdata.aerodromeRow(icao);
    if (!destinationRow) {
      warnings.push(
        `Flight plan to ${icao} skipped: aerodrome not in the navigation data`,
      );
      continue;
    }
    const departure = await navdata.aerodromePoint(BASE.icao);
    const destination = await navdata.aerodromePoint(icao);
    const waypoints = (ROUTES[icao] ?? []).map(userPoint);
    const data = aircraftData(booking.aircraft);
    const performance = data.performance;
    const front = data.massBalance?.stations.find((s) => s.id === 'front');
    const loads = front
      ? [{ stationId: front.id, massKg: booking.passengers > 0 ? 158 : 82 }]
      : [];
    // Enough fuel for the leg with its reserve, within what the tanks hold.
    const fuel = performance.fuel.tanks.map((tank, index) => ({
      tankId: tank.id,
      liters: index === 0 ? Math.min(tank.usableL, 90) : 0,
    }));
    const departureTime = new Date(booking.start.getTime() + 30 * 60_000);
    const altitude = icao === 'LFOC' ? 2500 : 3500;
    const legs = [...waypoints, destination].map(() => ({
      altitudeFt: altitude,
      cruiseSetting: null,
      windOverride: DEMO_WIND,
    }));
    const lats = [departure, ...waypoints, destination].map((p) => p.lat);
    const lons = [departure, ...waypoints, destination].map((p) => p.lon);
    const engineInput: EngineInput = {
      departureTime,
      departure,
      destination,
      alternate: null,
      waypoints,
      legs,
      reserveCase: 'VFR_DAY',
      qnhHpa: 1018,
      qnhSource: 'INPUT',
      qnhStation: null,
      qnhObservedAt: null,
      loads,
      fuel,
      envelopeCategory: 'NORMAL',
      performance,
      performanceStatus: 'VALIDATED',
      massBalance: data.massBalance,
      massBalanceValidated: true,
      settings,
      circuitHeightFt: destinationRow.extra?.circuitHeightFt ?? null,
      airspaces: airspaces.filter(
        (a) =>
          a.maxLat >= Math.min(...lats) - 0.2 &&
          a.minLat <= Math.max(...lats) + 0.2 &&
          a.maxLon >= Math.min(...lons) - 0.3 &&
          a.minLon <= Math.max(...lons) + 0.3,
      ),
      navdata: navdata.status(cycle, now),
      wind: null,
      windSource:
        'Vent saisi par le pilote (démonstration) / wind entered by the pilot',
      windCoverage: null,
      weather: [],
    };
    const result = computeFlightPlan(engineInput);
    const input = {
      aircraftId: booking.aircraft.id,
      reservationId: booking.id,
      departureTime: departureTime.toISOString(),
      departure: { navPointId: departure.id },
      destination: { navPointId: destination.id },
      alternate: null,
      waypoints: waypoints.map((w) => ({ navPointId: w.id, name: w.name })),
      legs: legs.map((leg) => ({
        altitudeFt: leg.altitudeFt,
        windOverride: leg.windOverride,
      })),
      reserveCase: 'VFR_DAY',
      qnhHpa: 1018,
      loads,
      fuel,
      envelopeCategory: 'NORMAL',
    };
    plans.push({
      booking,
      input,
      result,
      legacy: legacyFlightColumns(result, {
        flight_category: booking.category,
        number_of_passengers: booking.passengers,
      }),
    });
  }
  return { plans, warnings };
};

export { PLAN_ENGINE };
