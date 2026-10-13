import { DataSource } from 'typeorm';
import { Flight } from '../../modules/flights/entity/flights.entity';
import { User } from '../../modules/users/entity/users.entity';
import { Aircraft } from '../../modules/aircraft/entity/aircraft.entity';
import { FlightsService } from '../../modules/flights/flights.service';
import { INSTRUCTION_COUNTS_IN_INSTRUCTOR_TOTAL } from '../../modules/flights/flight-rules';
import {
  FlightCategory,
  Reservation,
  ReservationStatus,
} from '../../modules/reservations/entity/reservations.entity';

const DEFAULT_ORIGIN = 'LFPG';

const ROUTE_CATALOG: Partial<Record<FlightCategory, Record<string, string[]>>> =
  {
    [FlightCategory.LOCAL]: {
      LFPG: ['LFPO', 'LFPN', 'LFPT'],
      LFPO: ['LFPN', 'LFPG', 'LFPT'],
      LFLL: ['LFLY', 'LFLS', 'LFLE'],
      LFBD: ['LFBE', 'LFBS', 'LFBO'],
      LFML: ['LFMT', 'LFTH', 'LFMQ'],
      LFRS: ['LFRI', 'LFRM', 'LFBI'],
      LFST: ['LFGA', 'LFSG', 'LFQC'],
      default: ['LFPO', 'LFLL', 'LFBD'],
    },
    [FlightCategory.TRAINING]: {
      LFPG: ['LFPO', 'LFPN', 'LFPZ'],
      LFPO: ['LFPN', 'LFPG', 'LFPM'],
      LFLL: ['LFLY', 'LFLS', 'LFKX'],
      LFBD: ['LFBE', 'LFBS', 'LFDI'],
      LFML: ['LFMT', 'LFTH', 'LFMI'],
      LFRS: ['LFRI', 'LFRM', 'LFRE'],
      LFST: ['LFGA', 'LFSG', 'LFJL'],
      default: ['LFPO', 'LFBO', 'LFLL'],
    },
    [FlightCategory.INSTRUCTION]: {
      LFPG: ['LFPO', 'LFPN', 'LFPZ'],
      LFPO: ['LFPN', 'LFPG', 'LFPM'],
      LFLL: ['LFLY', 'LFLS', 'LFKX'],
      LFBD: ['LFBE', 'LFBO', 'LFBX'],
      LFML: ['LFMT', 'LFMN', 'LFTH'],
      LFRS: ['LFRI', 'LFRM', 'LFBI'],
      default: ['LFPO', 'LFLL', 'LFBO'],
    },
    [FlightCategory.TOURISM]: {
      LFPG: ['LFRG', 'LFPD', 'LFAT'],
      LFPO: ['LFRG', 'LFAT', 'LFBV'],
      LFLL: ['LFKX', 'LFMH', 'LFMD'],
      LFBD: ['LFBZ', 'LFBP', 'LFBM'],
      LFML: ['LFMN', 'LFKF', 'LFKB'],
      LFRS: ['LFBH', 'LFBY', 'LFRB'],
      LFST: ['LFMU', 'LFCM', 'LFSB'],
      default: ['LFRG', 'LFBZ', 'LFMN'],
    },
    [FlightCategory.CROSS_COUNTRY]: {
      LFPG: ['LFLL', 'LFBO', 'LFML'],
      LFPO: ['LFLL', 'LFBD', 'LFML'],
      LFLL: ['LFBD', 'LFBO', 'LFML'],
      LFBD: ['LFBO', 'LFML', 'LFMN'],
      LFML: ['LFLL', 'LFMN', 'LFBD'],
      LFRS: ['LFBO', 'LFBD', 'LFML'],
      LFST: ['LFLL', 'LFML', 'LFBD'],
      default: ['LFLL', 'LFBO', 'LFML'],
    },
    [FlightCategory.PRIVATE]: {
      default: ['LFMN', 'LFML', 'LFBD'],
    },
    [FlightCategory.CORPORATE]: {
      default: ['LFLL', 'LFML', 'LFMN'],
    },
    [FlightCategory.MAINTENANCE]: {
      default: ['LFPG', 'LFPO', 'LFLL'],
    },
  };

const FALLBACK_DESTINATIONS = ['LFLL', 'LFBO', 'LFBD', 'LFML', 'LFMN'];

const getReservationOrigin = (reservation: Reservation): string => {
  return (
    reservation.user?.preferred_aerodrome?.toUpperCase() ?? DEFAULT_ORIGIN
  ).trim();
};

const getCandidateDestinations = (reservation: Reservation): string[] => {
  const origin = getReservationOrigin(reservation);
  const categoryRoutes = ROUTE_CATALOG[reservation.flight_category] ?? {};
  const categoryCandidates = [
    ...(categoryRoutes[origin] ?? []),
    ...(categoryRoutes.default ?? []),
  ];

  return [...categoryCandidates, ...FALLBACK_DESTINATIONS].filter(
    (destination, index, allDestinations) =>
      destination !== origin && allDestinations.indexOf(destination) === index,
  );
};

export const seedDemoFlights = async (
  dataSource: DataSource,
  flightsService: FlightsService,
  reservations: Reservation[],
): Promise<Flight[]> => {
  const flightRepository = dataSource.getRepository(Flight);

  await flightRepository.createQueryBuilder().delete().execute();

  const confirmedReservations = reservations.filter(
    (reservation) => reservation.status === ReservationStatus.CONFIRMED,
  );

  const savedFlights: Flight[] = [];

  for (const reservation of confirmedReservations) {
    const origin = getReservationOrigin(reservation);
    const destinations = getCandidateDestinations(reservation);

    let savedFlight: Flight | null = null;
    let lastError: unknown = null;

    for (const destination of destinations) {
      try {
        savedFlight = await flightsService.createFlightByAI(
          origin,
          destination,
          reservation.user.id,
          reservation.id,
          {
            departure_time: reservation.start_time,
            flight_rules: 'VFR',
          },
        );
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!savedFlight) {
      const reason =
        lastError instanceof Error ? lastError.message : 'Unknown error';
      throw new Error(
        `Unable to generate demo flight for reservation ${reservation.id} (${origin}): ${reason}`,
      );
    }

    // A flight in the past has taken place: it is closed, and so in the logbook.
    // Its hours then count in the totals of the pilot and of the aircraft,
    // as when a member closes a flight.
    if (new Date(reservation.end_time) < new Date()) {
      savedFlight.closed_at = new Date(reservation.end_time);
      savedFlight = await flightRepository.save(savedFlight);

      const hours = Number(savedFlight.flight_hours) || 0;
      if (hours > 0) {
        await dataSource
          .getRepository(User)
          .increment({ id: reservation.user.id }, 'total_flight_hours', hours);
        // The instructor of an instruction flight was on board too.
        if (INSTRUCTION_COUNTS_IN_INSTRUCTOR_TOTAL && reservation.instructor) {
          await dataSource
            .getRepository(User)
            .increment(
              { id: reservation.instructor.id },
              'total_flight_hours',
              hours,
            );
        }
        await dataSource
          .getRepository(Aircraft)
          .increment(
            { id: reservation.aircraft.id },
            'total_flight_hours',
            hours,
          );
      }
    }

    savedFlights.push(savedFlight);
  }

  console.log(
    `${savedFlights.length} demo flights generated from confirmed reservations`,
  );
  return savedFlights;
};
