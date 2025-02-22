/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Flight } from './entity/flights.entity';
import { CreateFlightInput } from './dto/create-flight.input';
import { UpdateFlightInput } from './dto/update-flight.input';
import { Reservation } from '../reservations/entity/reservations.entity';
import { NotificationsService } from '../notifications/notifications.service';
import axios from 'axios';

@Injectable()
export class FlightsService {
  private readonly FPDB_API_KEY = process.env.FPDB_API_KEY;
  private readonly FPDB_BASE_URL = 'https://api.flightplandatabase.com';
  private readonly WEATHER_URL =
    'https://api.openweathermap.org/data/2.5/weather';
  private readonly WEATHER_API_KEY = process.env.OPENWEATHERMAP_API_KEY;

  constructor(
    @InjectRepository(Flight)
    private flightsRepository: Repository<Flight>,
    @InjectRepository(Reservation)
    private reservationsRepository: Repository<Reservation>,
    private readonly notificationsService: NotificationsService,
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
      message: `Votre plan de vol de ${flight.origin_icao} à ${flight.destination_icao} a été créé`,
      is_read: false,
    });

    return this.flightsRepository.save(flight);
  }

  async createFlightByAI(
    origin_icao: string,
    destination_icao: string,
    user_id: number,
    reservation_id?: number,
  ): Promise<Flight> {
    try {
      const reservation = await this.reservationsRepository.findOne({
        where: { id: reservation_id },
        relations: ['aircraft'],
      });

      if (!reservation) {
        throw new NotFoundException(
          `Reservation with ID ${reservation_id} not found`,
        );
      }

      const aircraft = reservation.aircraft;

      const departure = await this.fetchAirportInfo(origin_icao);

      const arrival = await this.fetchAirportInfo(destination_icao);

      const flightPlanResponse = await axios.post(
        `${this.FPDB_BASE_URL}/auto/generate`,
        {
          fromICAO: origin_icao,
          toICAO: destination_icao,
          cruiseSpeed: aircraft.cruiseSpeed,
          maxAltitude: aircraft.maxAltitude,
        },
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.FPDB_API_KEY}:`).toString('base64')}`,
          },
        },
      );

      const flightPlan = flightPlanResponse.data;

      const waypointsResponse = await axios.get(
        `${this.FPDB_BASE_URL}/plan/${flightPlan.id}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.FPDB_API_KEY}:`).toString('base64')}`,
          },
        },
      );

      const waypointsData = waypointsResponse.data.route.nodes;
      const waypoints = waypointsData.map((wp) => ({
        ident: wp.ident,
        type: wp.type,
        lat: wp.lat,
        lon: wp.lon,
        alt: wp.alt,
        name: wp.name,
      }));

      const encodedPolyline = flightPlan.encodedPolyline;

      const weatherDeparture = await this.fetchWeather(
        departure.lat,
        departure.lon,
      );

      const weatherArrival = await this.fetchWeather(arrival.lat, arrival.lon);

      const distanceKm = flightPlan.distance * 1.852;

      const flightHours = this.computeFlightTime(
        distanceKm,
        aircraft.cruiseSpeed,
      );

      const flight = new Flight();
      Object.assign(flight, {
        origin_icao,
        destination_icao,
        user: { id: user_id },
        reservation: { id: reservation_id },
        flight_hours: flightHours,
        flight_type: reservation.flight_category,
        distance_km: distanceKm,
        encoded_polyline: encodedPolyline,
        weather_conditions: `Departure: ${weatherDeparture.weather[0]?.description}, Arrival: ${weatherArrival.weather[0]?.description}`,
        waypoints: JSON.stringify(waypoints),
        number_of_passengers: reservation.number_of_passengers || 1,
      });

      await this.notificationsService.create({
        user_id: user_id,
        notification_type: 'FLIGHT_CREATED',
        notification_date: new Date(),
        message: `Votre plan de vol de ${flight.origin_icao} à ${flight.destination_icao} a été créé`,
        is_read: false,
      });

      return this.flightsRepository.save(flight);
    } catch (error) {
      console.error('Error in createFlightByAI:', error.message);
      throw new Error('Failed to generate flight plan via AI');
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

  async removeFlight(id: number): Promise<boolean> {
    const result = await this.flightsRepository.delete(id);
    return result.affected > 0;
  }

  async fetchAirportInfo(icao: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.FPDB_BASE_URL}/nav/airport/${icao}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.FPDB_API_KEY}:`).toString('base64')}`,
          },
        },
      );
      const data = response.data;

      const lat = data.lat || data.latitude || null;
      const lon = data.lon || data.longitude || null;

      if (lat === null || lon === null) {
        throw new Error(`Coordinates not available for airport ${icao}`);
      }

      return data;
    } catch (error) {
      console.error(`Failed to fetch airport info for ${icao}:`, error.message);
      throw new Error(`Failed to fetch airport info for ${icao}`);
    }
  }

  async fetchWeather(lat: number, lon: number): Promise<any> {
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
    } catch (error) {
      throw new Error(
        `Failed to fetch weather data for coordinates (${lat}, ${lon})`,
      );
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
    return Promise.all(
      waypoints.map(async (wp) => {
        try {
          const response = await axios.get(
            `${this.FPDB_BASE_URL}/nav/waypoint/${wp.ident}`,
            {
              headers: {
                Authorization: `Basic ${Buffer.from(`${this.FPDB_API_KEY}:`).toString('base64')}`,
              },
            },
          );
          const data = response.data;
          return `${wp.ident}: ${data.name}, Lat: ${data.lat}, Lon: ${data.lon}`;
        } catch (error) {
          return `${wp.ident}: Info not available`;
        }
      }),
    );
  }

  async getFlightsByUser(user_id: number): Promise<Flight[]> {
    return this.flightsRepository.find({
      where: { user: { id: user_id } },
      relations: ['user', 'reservation'],
    });
  }
}
