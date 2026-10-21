import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { Flight } from './entity/flights.entity';
import {
  FLIGHT_AMENDED,
  FLIGHT_DELETED,
  FlightAmendment,
} from './entity/flight-amendment.entity';
import {
  INSTRUCTION_COUNTS_IN_INSTRUCTOR_TOTAL,
  MAX_FLIGHT_HOURS,
  RECENT_FLIGHTS_MAX,
  FLIGHTS_OF_MEMBER_LISTED,
  FLIGHT_TYPES,
  flightTypeOf,
} from './flight-rules';
import { CreateFlightInput } from './dto/create-flight.input';
import { UpdateFlightInput } from './dto/update-flight.input';
import {
  Reservation,
  ReservationStatus,
} from '../reservations/entity/reservations.entity';
import { Aircraft } from '../aircraft/entity/aircraft.entity';
import { Incident } from '../incidents/entity/incidents.entity';
import { InstructionCourse } from '../instruction-courses/entity/instruction-courses.entity';
import { NotificationsService } from '../notifications/notifications.service';
import {
  hasRole,
  isAdmin,
  ROLE_INSTRUCTOR,
  SessionUser,
} from '../../common/auth/access';
import { User } from '../users/entity/users.entity';
import { buildFlightRecapPdf } from './flight-recap-pdf';
import { DEFAULT_LANGUAGE, Language } from '../../common/i18n/languages';
import { translate } from '../../common/i18n/translate';
import { localized } from '../../common/i18n/localized-exception';

export interface AIFlightOptions {
  preferred_runway_dep?: string;
  preferred_runway_arr?: string;
  cruise_altitude_ft?: number;
  departure_time?: Date;
  flight_rules?: 'VFR' | 'IFR';
  // Stored language of the pilot, who is the one notified.
  language?: Language;
  // The member asking, when the request comes from the API: the booking must
  // be theirs. Internal callers (demo data) leave it out.
  requester?: SessionUser;
}

// Computes a direct plan for a booking and returns the columns of the
// flight, and how to keep the plan once the flight is saved.
export type DirectPlanner = (
  reservation: Reservation,
  originIcao: string,
  destinationIcao: string,
  departureTime: Date,
  cruiseAltitudeFt: number | null,
) => Promise<{
  legacy: Record<string, any> & { waypoints: unknown[] };
  persist: (flightId: number, pilotId: number) => Promise<void>;
}>;

// What a flight adds to the totals of its pilot, of its instructor and of
// its aircraft.
interface CountedHours {
  userId: number | null;
  instructorId: number | null;
  aircraftId: number | null;
  hours: number;
}

const FLIGHT_RELATIONS = [
  'user',
  'instructor',
  'reservation',
  'reservation.aircraft',
  'reservation.user',
  'reservation.instructor',
];

const BOOKING_RELATIONS = ['aircraft', 'user', 'instructor'];

const sameId = (a: unknown, b: unknown): boolean =>
  a != null && b != null && Number(a) === Number(b);

@Injectable()
export class FlightsService {
  private readonly logger = new Logger(FlightsService.name);
  private directPlanner: DirectPlanner | null = null;

  constructor(
    @InjectRepository(Flight)
    private flightsRepository: Repository<Flight>,
    @InjectRepository(Reservation)
    private reservationsRepository: Repository<Reservation>,
    private readonly notificationsService: NotificationsService,
  ) {}

  useDirectPlanner(planner: DirectPlanner): void {
    this.directPlanner = planner;
  }

  // A flight is planned on a booking of the member, never on someone
  // else's. Only an administrator records a flight without a booking, or on
  // the booking of another member (the flight is then that member's).
  async bookingForNewFlight(
    reservationId: number | null | undefined,
    requester: SessionUser | undefined,
  ): Promise<Reservation | null> {
    if (!reservationId) {
      if (!isAdmin(requester)) {
        throw localized(BadRequestException, 'error.flight.bookingRequired');
      }
      return null;
    }

    const reservation = await this.reservationsRepository.findOne({
      where: { id: reservationId },
      relations: BOOKING_RELATIONS,
    });
    if (!reservation) {
      throw new NotFoundException(
        `Reservation with ID ${reservationId} not found`,
      );
    }
    if (!isAdmin(requester) && !sameId(reservation.user?.id, requester?.id)) {
      throw localized(ForbiddenException, 'error.flight.notOwnBooking');
    }
    if (reservation.status === ReservationStatus.CANCELLED) {
      throw localized(ConflictException, 'error.flight.bookingCancelled');
    }
    return reservation;
  }

  // A planned duration may still be zero; a flown one cannot.
  private assertPlausibleHours(value: unknown, flown: boolean): void {
    const hours = Number(value);
    if (
      !Number.isFinite(hours) ||
      hours < 0 ||
      hours > MAX_FLIGHT_HOURS ||
      (flown && hours === 0)
    ) {
      throw localized(BadRequestException, 'error.flight.hoursOutOfRange', {
        max: MAX_FLIGHT_HOURS,
      });
    }
  }

  private assertPlausibleTimes(flight: {
    departure_time?: Date | null;
    arrival_time?: Date | null;
  }): void {
    if (
      flight.departure_time &&
      flight.arrival_time &&
      new Date(flight.arrival_time).getTime() <=
        new Date(flight.departure_time).getTime()
    ) {
      throw localized(
        BadRequestException,
        'error.flight.arrivalBeforeDeparture',
      );
    }
  }

  // The type of a flight is a booking category: anything else is refused.
  private validFlightType(value: unknown): string {
    const type = flightTypeOf(value);
    if (!type) {
      throw localized(BadRequestException, 'error.flight.unknownType', {
        types: FLIGHT_TYPES.join(', '),
      });
    }
    return type;
  }

  // `language` is the stored language of the pilot, who is the one notified.
  async createFlightByUser(
    createFlightInput: CreateFlightInput,
    requester: SessionUser,
    language: Language = DEFAULT_LANGUAGE,
  ): Promise<Flight> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { reservation_id, user_id, ...otherFields } = createFlightInput;

    const reservation = await this.bookingForNewFlight(
      reservation_id,
      requester,
    );
    this.assertPlausibleHours(otherFields.flight_hours, false);
    this.assertPlausibleTimes(otherFields);
    otherFields.flight_type = this.validFlightType(otherFields.flight_type);

    // The pilot is the holder of the booking, the caller otherwise.
    const pilotId = reservation?.user?.id ?? requester.id;

    const flight = new Flight();
    Object.assign(flight, {
      ...otherFields,
      reservation: reservation ? { id: reservation.id } : null,
      user: { id: pilotId },
      // The instructor of the booking is on board.
      instructor: reservation?.instructor
        ? { id: reservation.instructor.id }
        : null,
      waypoints: JSON.stringify(otherFields.waypoints || []),
    });

    await this.notificationsService.create({
      user_id: pilotId,
      notification_type: 'FLIGHT_CREATED',
      notification_date: new Date(),
      message: translate(language, 'notification.flightPlanCreated', {
        origin: flight.origin_icao,
        destination: flight.destination_icao,
      }),
      is_read: false,
    });

    return this.flightsRepository.save(flight);
  }

  // The "generate a plan" of a booking: a direct route from departure to
  // destination computed by the flight preparation engine (handed over by
  // the navplan module), returned as a flight like before.
  async createFlightByAI(
    origin_icao: string,
    destination_icao: string,
    user_id: number,
    reservation_id?: number,
    options?: AIFlightOptions,
  ): Promise<Flight> {
    const language = options?.language ?? DEFAULT_LANGUAGE;
    try {
      if (!reservation_id) {
        throw new BadRequestException('Reservation ID is required');
      }

      const reservation = await this.reservationsRepository.findOne({
        where: { id: reservation_id },
        relations: BOOKING_RELATIONS,
      });

      if (!reservation) {
        throw new NotFoundException(`Reservation ${reservation_id} not found`);
      }

      const requester = options?.requester;
      if (requester) {
        if (
          !isAdmin(requester) &&
          !sameId(reservation.user?.id, requester.id)
        ) {
          throw localized(ForbiddenException, 'error.flight.notOwnBooking');
        }
        if (reservation.status === ReservationStatus.CANCELLED) {
          throw localized(ConflictException, 'error.flight.bookingCancelled');
        }
        // The flight belongs to the holder of the booking.
        user_id = reservation.user?.id ?? user_id;
      }

      if (!reservation.aircraft) {
        throw new BadRequestException('Aircraft configuration incomplete');
      }
      if (!this.directPlanner) {
        throw new InternalServerErrorException('Flight planner unavailable');
      }

      const departureTime = options?.departure_time ?? reservation.start_time;
      const plan = await this.directPlanner(
        reservation,
        origin_icao.toUpperCase(),
        destination_icao.toUpperCase(),
        new Date(departureTime),
        options?.cruise_altitude_ft ?? null,
      );

      const flight = this.flightsRepository.create({
        ...plan.legacy,
        user: { id: user_id },
        reservation: { id: reservation_id },
        instructor: reservation.instructor
          ? { id: reservation.instructor.id }
          : null,
        flight_type: reservation.flight_category,
        number_of_passengers: reservation.number_of_passengers || 1,
        waypoints: JSON.stringify(plan.legacy.waypoints),
      } as any) as unknown as Flight;

      const savedFlight = await this.flightsRepository.save(flight);
      await plan.persist(savedFlight.id, user_id);

      await this.notificationsService.create({
        user_id: user_id,
        notification_type: 'FLIGHT_CREATED',
        notification_date: new Date(),
        message: translate(language, 'notification.flightPlanGenerated', {
          origin: origin_icao,
          destination: destination_icao,
        }),
        is_read: false,
      });

      return savedFlight;
    } catch (error: any) {
      this.logger.error(
        `Flight creation failed: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Flight generation error', {
        cause: error,
        description: 'Please check flight parameters and try again',
      });
    }
  }

  async findAll(): Promise<Flight[]> {
    return this.flightsRepository.find();
  }

  // The summary of a flight as a PDF, for its pilot or an administrator.
  async exportRecapPdf(id: number, requester?: SessionUser): Promise<string> {
    const flight = await this.flightsRepository.findOne({
      where: { id },
      relations: ['user', 'reservation', 'reservation.aircraft'],
    });
    if (!flight) {
      throw localized(NotFoundException, 'error.flight.notFound');
    }
    if (
      !isAdmin(requester) &&
      Number(flight.user?.id) !== Number(requester?.id)
    ) {
      throw localized(ForbiddenException, 'error.flight.notOwnFlightExport');
    }
    return buildFlightRecapPdf(flight);
  }

  async findOne(id: number): Promise<Flight> {
    const flight = await this.flightsRepository.findOne({
      where: { id },
      relations: ['user', 'instructor', 'reservation'],
    });
    if (!flight) {
      throw localized(NotFoundException, 'error.flight.notFound');
    }
    return flight;
  }

  // Whether the instructor has at least one course with this member.
  private async teaches(
    instructorId: number,
    studentId: number,
  ): Promise<boolean> {
    const courses = await this.flightsRepository.manager.count(
      InstructionCourse,
      {
        where: {
          instructor: { id: instructorId },
          student: { id: studentId },
        },
      },
    );
    return courses > 0;
  }

  // The flights of a member are read by that member, by an administrator
  // and by an instructor who teaches them. The flights of one booking are
  // also read by the instructor of that booking (`bookingInstructorId`),
  // who was on board: that booking's, not the pilot's other flights.
  async canReadFlightsOf(
    pilotId: number | null | undefined,
    requester: SessionUser | undefined | null,
    bookingInstructorId?: number | null,
  ): Promise<boolean> {
    if (
      isAdmin(requester) ||
      sameId(pilotId, requester?.id) ||
      sameId(bookingInstructorId, requester?.id)
    ) {
      return true;
    }
    return (
      pilotId != null &&
      requester?.id != null &&
      hasRole(requester, ROLE_INSTRUCTOR) &&
      (await this.teaches(Number(requester.id), Number(pilotId)))
    );
  }

  async assertCanReadFlightsOf(
    pilotId: number | null | undefined,
    requester: SessionUser | undefined | null,
    bookingInstructorId?: number | null,
  ): Promise<void> {
    if (
      !(await this.canReadFlightsOf(pilotId, requester, bookingInstructorId))
    ) {
      throw localized(ForbiddenException, 'error.flight.notOwnFlightRead');
    }
  }

  async findOneFor(id: number, requester?: SessionUser): Promise<Flight> {
    const flight = await this.findOne(id);
    await this.assertCanReadFlightsOf(
      flight.user?.id,
      requester,
      flight.instructor?.id ?? flight.reservation?.instructor?.id,
    );
    return flight;
  }

  private countedHours(flight: Flight): CountedHours {
    return {
      userId: flight.user?.id ?? null,
      instructorId: flight.instructor?.id ?? null,
      aircraftId: flight.reservation?.aircraft?.id ?? null,
      hours: flight.closed_at ? Number(flight.flight_hours) || 0 : 0,
    };
  }

  // Totals of the members on board and of the aircraft follow their closed
  // flights: what the flight counted before is taken back, what it counts
  // now is added. The hours count once for the aircraft, and for each of
  // the pilot and the instructor.
  private async moveCountedHours(
    manager: EntityManager,
    before: CountedHours,
    after: CountedHours,
  ): Promise<void> {
    const hoursByMember = (counted: CountedHours): Map<number, number> => {
      const members = INSTRUCTION_COUNTS_IN_INSTRUCTOR_TOTAL
        ? [counted.userId, counted.instructorId]
        : [counted.userId];
      const hours = new Map<number, number>();
      for (const id of members) {
        if (id != null) hours.set(Number(id), counted.hours);
      }
      return hours;
    };
    const hoursByAircraft = (counted: CountedHours): Map<number, number> =>
      new Map(
        counted.aircraftId != null
          ? [[Number(counted.aircraftId), counted.hours]]
          : [],
      );

    const totals: [
      typeof User | typeof Aircraft,
      Map<number, number>,
      Map<number, number>,
    ][] = [
      [User, hoursByMember(before), hoursByMember(after)],
      [Aircraft, hoursByAircraft(before), hoursByAircraft(after)],
    ];

    for (const [entity, counted, counts] of totals) {
      for (const id of new Set([...counted.keys(), ...counts.keys()])) {
        const delta = (counts.get(id) ?? 0) - (counted.get(id) ?? 0);
        if (delta !== 0) {
          await manager.increment(entity, { id }, 'total_flight_hours', delta);
        }
      }
    }
  }

  private snapshot(flight: Flight): Record<string, unknown> {
    return {
      user_id: flight.user?.id ?? null,
      instructor_id: flight.instructor?.id ?? null,
      reservation_id: flight.reservation?.id ?? null,
      aircraft_id: flight.reservation?.aircraft?.id ?? null,
      flight_hours: flight.flight_hours ?? null,
      flight_type: flight.flight_type ?? null,
      origin_icao: flight.origin_icao ?? null,
      destination_icao: flight.destination_icao ?? null,
      departure_time: flight.departure_time ?? null,
      arrival_time: flight.arrival_time ?? null,
      distance_km: flight.distance_km ?? null,
      number_of_passengers: flight.number_of_passengers ?? null,
      remarks: flight.remarks ?? null,
      closed_at: flight.closed_at ?? null,
    };
  }

  // What must hold for a flight to be closed, whoever closes it.
  private assertClosable(flight: Flight, requester?: SessionUser): void {
    const reservation = flight.reservation;

    if (!reservation) {
      // A flight without a booking is recorded by an administrator only.
      if (!isAdmin(requester)) {
        throw localized(ConflictException, 'error.flight.noBookingToClose');
      }
    } else {
      if (reservation.status === ReservationStatus.CANCELLED) {
        throw localized(ConflictException, 'error.flight.bookingCancelled');
      }
      if (!isAdmin(requester) && !sameId(reservation.user?.id, requester?.id)) {
        throw localized(ForbiddenException, 'error.flight.notOwnBooking');
      }
      if (new Date(reservation.start_time).getTime() > Date.now()) {
        throw localized(ConflictException, 'error.flight.bookingNotStarted');
      }
    }

    this.assertPlausibleHours(flight.flight_hours, true);
  }

  async updateFlight(
    id: number,
    updateFlightInput: UpdateFlightInput,
    requester?: SessionUser,
  ): Promise<Flight> {
    const flight = await this.flightsRepository.findOne({
      where: { id },
      relations: FLIGHT_RELATIONS,
    });
    if (!flight) {
      throw localized(NotFoundException, 'error.flight.notFound');
    }

    const {
      closed,
      user_id,
      reservation_id,
      ...changes
    }: Partial<UpdateFlightInput> = updateFlightInput;
    const admin = isAdmin(requester);

    if (!admin) {
      if (!sameId(flight.user?.id, requester?.id)) {
        throw localized(ForbiddenException, 'error.flight.notOwnFlightUpdate');
      }
      // A closed flight is final for its pilot; an administrator can amend it.
      if (flight.closed_at) {
        throw localized(ConflictException, 'error.flight.alreadyClosed');
      }
    }

    const wasClosed = !!flight.closed_at;
    const before = this.countedHours(flight);
    const snapshotBefore = this.snapshot(flight);

    // Only an administrator moves a flight to another member or booking.
    if (admin && reservation_id != null) {
      const reservation = await this.reservationsRepository.findOne({
        where: { id: reservation_id },
        relations: BOOKING_RELATIONS,
      });
      if (!reservation) {
        throw new NotFoundException(
          `Reservation with ID ${reservation_id} not found`,
        );
      }
      flight.reservation = reservation;
      // The instructor on board is the one of the booking.
      flight.instructor = reservation.instructor ?? null;
    }
    if (admin && user_id != null && !sameId(user_id, flight.user?.id)) {
      const pilot = await this.flightsRepository.manager.findOne(User, {
        where: { id: user_id },
      });
      if (!pilot) {
        throw new NotFoundException(`User with ID ${user_id} not found`);
      }
      flight.user = pilot;
    }

    if (changes.flight_type == null) {
      delete changes.flight_type;
    } else {
      changes.flight_type = this.validFlightType(changes.flight_type);
    }
    if (changes.waypoints) {
      (changes as any).waypoints = JSON.stringify(changes.waypoints);
    }
    Object.assign(flight, changes);

    // A closed flight counts in the totals: its duration cannot be empty.
    const closing = !!closed && !wasClosed;
    this.assertPlausibleHours(flight.flight_hours, closing || wasClosed);
    this.assertPlausibleTimes(flight);
    if (closing) {
      this.assertClosable(flight, requester);
      // The flight records the instructor of its booking as it stands when
      // the flight is closed.
      if (flight.reservation) {
        flight.instructor = flight.reservation.instructor ?? null;
      }
    }

    return this.flightsRepository.manager.transaction(async (manager) => {
      if (closing) {
        // Two requests closing the same flight: only one of them counts.
        const closedAt = new Date();
        const claimed = await manager.update(
          Flight,
          { id, closed_at: IsNull() },
          { closed_at: closedAt },
        );
        if (!claimed.affected) {
          throw localized(ConflictException, 'error.flight.alreadyClosed');
        }
        flight.closed_at = closedAt;
      }

      const saved = await manager.save(Flight, flight);
      await this.moveCountedHours(manager, before, this.countedHours(flight));

      if (wasClosed) {
        await manager.save(FlightAmendment, {
          flight_id: id,
          action: FLIGHT_AMENDED,
          actor_id: requester?.id ?? null,
          before: snapshotBefore,
          after: this.snapshot(flight),
        });
        this.logger.warn(
          `Closed flight ${id} amended by user ${requester?.id ?? 'unknown'}`,
        );
      }
      return saved;
    });
  }

  // An open flight plan is deleted by its pilot. A closed flight is a record:
  // only an administrator removes it, its hours are taken back and a trace
  // is kept.
  async removeFlight(id: number, requester?: SessionUser): Promise<boolean> {
    const flight = await this.flightsRepository.findOne({
      where: { id },
      relations: FLIGHT_RELATIONS,
    });

    if (!flight) {
      throw localized(NotFoundException, 'error.flight.notFound');
    }

    if (!isAdmin(requester)) {
      if (!sameId(flight.user?.id, requester?.id)) {
        throw localized(ForbiddenException, 'error.flight.notOwnFlightDelete');
      }
      if (flight.closed_at) {
        throw localized(ConflictException, 'error.flight.closedNotDeletable');
      }
    }

    // The database would refuse anyway: say why instead.
    const incidents = await this.flightsRepository.manager.count(Incident, {
      where: { flight: { id } },
    });
    if (incidents > 0) {
      throw localized(ConflictException, 'error.flight.hasIncident');
    }

    const before = this.countedHours(flight);

    return this.flightsRepository.manager.transaction(async (manager) => {
      const result = await manager.delete(Flight, id);
      if (!result.affected) {
        return false;
      }
      if (flight.closed_at) {
        await this.moveCountedHours(manager, before, {
          userId: null,
          instructorId: null,
          aircraftId: null,
          hours: 0,
        });
        await manager.save(FlightAmendment, {
          flight_id: id,
          action: FLIGHT_DELETED,
          actor_id: requester?.id ?? null,
          before: this.snapshot(flight),
          after: null,
        });
        this.logger.warn(
          `Closed flight ${id} deleted by user ${requester?.id ?? 'unknown'}`,
        );
      }
      return true;
    });
  }

  computeFlightTime(distanceKm: number, cruiseSpeedKmh: number): number {
    if (cruiseSpeedKmh <= 0) {
      throw new Error('Cruise speed must be greater than 0');
    }
    return distanceKm / cruiseSpeedKmh;
  }

  async getDetailedWaypoints(waypointsJson: string): Promise<string[]> {
    const waypoints = JSON.parse(waypointsJson);
    return waypoints.map(
      (wp: {
        ident: string;
        type?: string;
        name?: string;
        lat?: number;
        lon?: number;
        alt?: number;
        phase?: string;
        speed_kts?: number;
        ground_speed_kts?: number;
        wind_correction_deg?: number;
        fuel_remaining_liters?: number;
        time_from_dep_min?: number;
        leg_distance_nm?: number;
      }) => {
        const parts = [
          `${wp.ident} (${wp.type ?? 'FIX'}) [${wp.phase ?? ''}]`,
          wp.name ?? 'Waypoint',
          `Lat: ${wp.lat ?? 'N/A'}, Lon: ${wp.lon ?? 'N/A'}`,
          `Alt: ${wp.alt ?? 'N/A'}ft`,
        ];
        if (wp.speed_kts) parts.push(`IAS: ${wp.speed_kts}kt`);
        if (wp.ground_speed_kts) parts.push(`GS: ${wp.ground_speed_kts}kt`);
        if (wp.wind_correction_deg)
          parts.push(
            `WCA: ${wp.wind_correction_deg > 0 ? '+' : ''}${wp.wind_correction_deg}°`,
          );
        if (wp.time_from_dep_min != null)
          parts.push(`T+${wp.time_from_dep_min}min`);
        if (wp.leg_distance_nm) parts.push(`LEG: ${wp.leg_distance_nm}NM`);
        return parts.join(', ');
      },
    );
  }

  // The member's latest flights and flight plans, newest first.
  async getFlightsByUser(user_id: number): Promise<Flight[]> {
    return this.flightsRepository.find({
      where: { user: { id: user_id } },
      relations: ['user', 'instructor', 'reservation'],
      order: { id: 'DESC' },
      take: FLIGHTS_OF_MEMBER_LISTED,
    });
  }

  async getRecentFlights(limit: number): Promise<Flight[]> {
    return this.flightsRepository.find({
      order: { reservation: { start_time: 'DESC' } },
      take: Math.min(Math.max(Math.trunc(limit) || 1, 1), RECENT_FLIGHTS_MAX),
      relations: ['user', 'reservation'],
    });
  }
}
