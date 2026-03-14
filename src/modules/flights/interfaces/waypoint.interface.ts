export type WaypointType = 'APT' | 'SID' | 'TOC' | 'FIX' | 'TOD' | 'STAR' | 'APP';

export type FlightPhase =
  | 'DEPARTURE'
  | 'INITIAL_CLIMB'
  | 'CLIMB'
  | 'CRUISE'
  | 'DESCENT'
  | 'APPROACH'
  | 'FINAL'
  | 'LANDING';

export interface Waypoint {
  ident: string;
  type: WaypointType;
  lat: number;
  lon: number;
  alt: number;
  name: string;
  speed_kts?: number;
  heading_deg?: number;
  phase?: FlightPhase;
  ground_speed_kts?: number;
  wind_correction_deg?: number;
  fuel_remaining_liters?: number;
  time_from_dep_min?: number;
  leg_distance_nm?: number;
}
