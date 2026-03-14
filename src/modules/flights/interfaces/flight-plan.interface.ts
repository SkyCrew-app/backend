import { MetarData } from '../metar.service';
import {
  AircraftPerformanceProfile,
  FuelPolicy,
  PhaseTimeFuel,
  SegmentWind,
} from './performance.interface';
import { Waypoint } from './waypoint.interface';

export interface FlightPlanOptions {
  preferred_runway_dep?: string;
  preferred_runway_arr?: string;
  cruise_altitude_ft?: number;
  flight_rules?: 'VFR' | 'IFR';
  metar_departure?: MetarData | null;
  metar_arrival?: MetarData | null;
  performance?: AircraftPerformanceProfile;
}

export interface FlightPlanResult {
  distance_km: number;
  encoded_polyline: string;
  waypoints: Waypoint[];
  flight_hours: number;
  estimated_fuel_liters?: number;
  departure_runway?: string;
  arrival_runway?: string;
  fuel_policy?: FuelPolicy;
  phase_breakdown?: PhaseTimeFuel[];
  wind_summary?: SegmentWind;
  performance_profile?: string;
}
