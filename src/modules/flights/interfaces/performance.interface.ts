export interface PhasePerformance {
  rate_fpm?: number;
  ias_kts?: number;
  fuel_lph: number;
  ceiling_ft?: number;
  tas_kts?: number;
  vref_kts?: number;
}

export interface AircraftPerformanceProfile {
  icao_type: string;
  category: string;
  climb: PhasePerformance;
  cruise: PhasePerformance;
  descent: PhasePerformance;
  approach: PhasePerformance;
  taxi_fuel_liters: number;
  usable_fuel_liters: number;
  max_range_nm: number;
}

export interface FuelPolicy {
  taxi_liters: number;
  trip_liters: number;
  contingency_liters: number;
  alternate_liters: number;
  final_reserve_liters: number;
  total_liters: number;
}

export interface SegmentWind {
  wind_dir_deg: number;
  wind_speed_kts: number;
  headwind_kts: number;
  crosswind_kts: number;
  wca_deg: number;
  ground_speed_kts: number;
}

export interface PhaseTimeFuel {
  phase: string;
  time_min: number;
  fuel_liters: number;
  distance_nm: number;
}
