import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Flight } from './entity/flights.entity';
import { CreateFlightInput } from './dto/create-flight.input';
import { UpdateFlightInput } from './dto/update-flight.input';
import { Reservation } from '../reservations/entity/reservations.entity';
import { NotificationsService } from '../notifications/notifications.service';
import axios from 'axios';
import { AirportsService } from './airports.service';
import { FlightPlanGeneratorService } from './flight-plan-generator.service';
import { AircraftPerformanceService } from './aircraft-performance.service';
import { MetarService } from './metar.service';
import { WeatherResponse } from './interfaces/weather.interface';
import { computeBearing } from './utils/geo.utils';

export interface AIFlightOptions {
  preferred_runway_dep?: string;
  preferred_runway_arr?: string;
  cruise_altitude_ft?: number;
  departure_time?: Date;
  flight_rules?: 'VFR' | 'IFR';
}

@Injectable()
export class FlightsService {
  private readonly WEATHER_URL =
    'https://api.openweathermap.org/data/2.5/weather';
  private readonly WEATHER_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
  private readonly logger = new Logger(FlightsService.name);

  constructor(
    @InjectRepository(Flight)
    private flightsRepository: Repository<Flight>,
    @InjectRepository(Reservation)
    private reservationsRepository: Repository<Reservation>,
    private readonly notificationsService: NotificationsService,
    private readonly airportsService: AirportsService,
    private readonly flightPlanGenerator: FlightPlanGeneratorService,
    private readonly aircraftPerformance: AircraftPerformanceService,
    private readonly metarService: MetarService,
  ) {}

  async createFlightByUser(
    createFlightInput: CreateFlightInput,
  ): Promise<Flight> {
    const { reservation_id, user_id, ...otherFields } = createFlightInput;

    const reservation = reservation_id
      ? await this.reservationsRepository.findOne({
          where: { id: reservation_id },
        })
      : null;

    if (reservation_id && !reservation) {
      throw new NotFoundException(
        `Reservation with ID ${reservation_id} not found`,
      );
    }

    const flight = new Flight();
    Object.assign(flight, {
      ...otherFields,
      reservation: reservation ? { id: reservation_id } : null,
      user: { id: user_id },
      waypoints: JSON.stringify(otherFields.waypoints || []),
    });

    await this.notificationsService.create({
      user_id: user_id,
      notification_type: 'FLIGHT_CREATED',
      notification_date: new Date(),
      message: `Votre plan de vol de ${flight.origin_icao} a ${flight.destination_icao} a ete cree`,
      is_read: false,
    });

    return this.flightsRepository.save(flight);
  }

  async createFlightByAI(
    origin_icao: string,
    destination_icao: string,
    user_id: number,
    reservation_id?: number,
    options?: AIFlightOptions,
  ): Promise<Flight> {
    try {
      if (!reservation_id) {
        throw new BadRequestException('Reservation ID is required');
      }

      const reservation = await this.reservationsRepository.findOne({
        where: { id: reservation_id },
        relations: ['aircraft'],
      });

      if (!reservation) {
        throw new NotFoundException(`Reservation ${reservation_id} not found`);
      }

      const aircraft = reservation.aircraft;
      if (!aircraft?.cruiseSpeed || !aircraft?.maxAltitude) {
        throw new BadRequestException('Aircraft configuration incomplete');
      }

      // Get performance profile for this aircraft model
      const perfProfile = this.aircraftPerformance.getProfile(
        aircraft.model,
        aircraft.cruiseSpeed,
        aircraft.consumption,
      );

      const departure = this.airportsService.getAirportInfo(origin_icao);
      const arrival = this.airportsService.getAirportInfo(destination_icao);

      // Fetch weather + METAR in parallel
      const [weatherDeparture, weatherArrival, metarDep, metarArr] =
        await Promise.all([
          this.fetchWeatherSafe(departure.lat, departure.lon),
          this.fetchWeatherSafe(arrival.lat, arrival.lon),
          this.metarService.fetchMetarSafe(origin_icao),
          this.metarService.fetchMetarSafe(destination_icao),
        ]);

      // Generate flight plan with performance data + METAR
      const flightPlan = this.flightPlanGenerator.generateFlightPlan(
        departure,
        arrival,
        aircraft.cruiseSpeed,
        aircraft.maxAltitude,
        reservation.flight_category,
        aircraft.consumption,
        {
          preferred_runway_dep: options?.preferred_runway_dep,
          preferred_runway_arr: options?.preferred_runway_arr,
          cruise_altitude_ft: options?.cruise_altitude_ft,
          flight_rules: options?.flight_rules,
          metar_departure: metarDep,
          metar_arrival: metarArr,
          performance: perfProfile,
        },
      );

      // Use flight_hours from the enriched flight plan (includes WCA/GS)
      const adjustedFlightHours = flightPlan.flight_hours;

      // Compute departure and arrival times
      const departureTime = options?.departure_time ?? reservation.start_time;
      const arrivalTime = new Date(
        departureTime.getTime() + adjustedFlightHours * 3_600_000,
      );

      // Build weather conditions string
      const weatherParts: string[] = [];
      weatherParts.push(
        `DEP ${departure.icao}(${departure.name}) ${weatherDeparture?.weather?.[0]?.description ?? 'Unavailable'} ${weatherDeparture?.main?.temp ?? 'N/A'}C`,
      );
      if (metarDep?.rawOb) {
        weatherParts.push(`METAR DEP: ${metarDep.rawOb}`);
      }
      weatherParts.push(
        `ARR ${arrival.icao}(${arrival.name}) ${weatherArrival?.weather?.[0]?.description ?? 'Unavailable'} ${weatherArrival?.main?.temp ?? 'N/A'}C`,
      );
      if (metarArr?.rawOb) {
        weatherParts.push(`METAR ARR: ${metarArr.rawOb}`);
      }

      // Append weather info to first/last waypoint names
      const waypointsWithContext = flightPlan.waypoints.map(
        (waypoint, index, allWaypoints) => {
          if (index === 0) {
            return {
              ...waypoint,
              name: `${waypoint.name} | METEO ${weatherDeparture?.weather?.[0]?.description ?? 'Unavailable'} | WIND ${metarDep?.wspd ?? weatherDeparture?.wind?.speed ?? 'N/A'}kt`,
            };
          }

          if (index === allWaypoints.length - 1) {
            return {
              ...waypoint,
              name: `${waypoint.name} | METEO ${weatherArrival?.weather?.[0]?.description ?? 'Unavailable'} | WIND ${metarArr?.wspd ?? weatherArrival?.wind?.speed ?? 'N/A'}kt`,
            };
          }

          return waypoint;
        },
      );

      const flight = this.flightsRepository.create({
        origin_icao,
        destination_icao,
        user: { id: user_id },
        reservation: { id: reservation_id },
        flight_hours: adjustedFlightHours,
        estimated_flight_time: adjustedFlightHours,
        flight_type: reservation.flight_category,
        distance_km: flightPlan.distance_km,
        encoded_polyline: flightPlan.encoded_polyline,
        weather_conditions: weatherParts.join(' | '),
        waypoints: JSON.stringify(waypointsWithContext),
        number_of_passengers: reservation.number_of_passengers || 1,
        departure_time: departureTime,
        arrival_time: arrivalTime,
        fuel_policy: flightPlan.fuel_policy
          ? JSON.stringify(flightPlan.fuel_policy)
          : null,
        wind_summary: flightPlan.wind_summary
          ? JSON.stringify(flightPlan.wind_summary)
          : null,
        performance_profile: flightPlan.performance_profile ?? null,
        estimated_fuel_liters: flightPlan.fuel_policy?.total_liters ?? null,
      });

      const savedFlight = await this.flightsRepository.save(flight);

      await this.notificationsService.create({
        user_id: user_id,
        notification_type: 'FLIGHT_CREATED',
        notification_date: new Date(),
        message: `Votre plan de vol de ${origin_icao} a ${destination_icao} a ete genere automatiquement`,
        is_read: false,
      });

      savedFlight.departure_airport_info = JSON.stringify(departure);
      savedFlight.arrival_airport_info = JSON.stringify(arrival);
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

  async findOne(id: number): Promise<Flight> {
    const flight = await this.flightsRepository.findOne({
      where: { id },
      relations: ['user', 'reservation'],
    });
    if (!flight) {
      throw new NotFoundException(`Flight with ID ${id} not found`);
    }
    return flight;
  }

  async updateFlight(
    id: number,
    updateFlightInput: UpdateFlightInput,
  ): Promise<Flight> {
    const flight = await this.flightsRepository.findOne({ where: { id } });
    if (!flight) {
      throw new NotFoundException(`Flight with ID ${id} not found`);
    }

    if (updateFlightInput.waypoints) {
      (updateFlightInput as any).waypoints = JSON.stringify(
        updateFlightInput.waypoints,
      );
    }

    Object.assign(flight, updateFlightInput);
    return this.flightsRepository.save(flight);
  }

  async removeFlight(id: number, requestingUserId: number): Promise<boolean> {
    const flight = await this.flightsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!flight) {
      throw new NotFoundException(`Flight with ID ${id} not found`);
    }

    if (flight.user.id !== requestingUserId) {
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que vos propres vols',
      );
    }

    const result = await this.flightsRepository.delete(id);
    return result.affected > 0;
  }

  async fetchWeather(lat: number, lon: number): Promise<WeatherResponse> {
    try {
      const response = await axios.get(this.WEATHER_URL, {
        params: {
          lat,
          lon,
          appid: this.WEATHER_API_KEY,
          units: 'metric',
          lang: 'fr',
        },
      });
      return response.data;
    } catch {
      throw new Error(
        `Failed to fetch weather data for coordinates (${lat}, ${lon})`,
      );
    }
  }

  private async fetchWeatherSafe(
    lat: number,
    lon: number,
  ): Promise<WeatherResponse | null> {
    try {
      return await this.fetchWeather(lat, lon);
    } catch (error: any) {
      this.logger.warn(
        `Weather unavailable for (${lat}, ${lon}): ${error.message}`,
      );
      return null;
    }
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
        if (wp.wind_correction_deg) parts.push(`WCA: ${wp.wind_correction_deg > 0 ? '+' : ''}${wp.wind_correction_deg}°`);
        if (wp.time_from_dep_min != null) parts.push(`T+${wp.time_from_dep_min}min`);
        if (wp.leg_distance_nm) parts.push(`LEG: ${wp.leg_distance_nm}NM`);
        return parts.join(', ');
      },
    );
  }

  async getFlightsByUser(user_id: number): Promise<Flight[]> {
    return this.flightsRepository.find({
      where: { user: { id: user_id } },
      relations: ['user', 'reservation'],
    });
  }

  async getRecentFlights(limit: number): Promise<Flight[]> {
    return this.flightsRepository.find({
      order: { reservation: { start_time: 'DESC' } },
      take: limit,
      relations: ['user', 'reservation'],
    });
  }
}
