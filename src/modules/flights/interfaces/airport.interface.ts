export interface RunwayDetail {
  le_ident: string;
  he_ident: string;
  length_ft: number;
  width_ft: number;
  surface: string;
  lighted: boolean;
}

export interface AirportData {
  icao: string;
  iata: string | null;
  name: string;
  city: string | null;
  country: string | null;
  lat: number;
  lon: number;
  elevation_ft: number | null;
  type: 'large_airport' | 'medium_airport' | 'small_airport';
  continent: string | null;
  runways?: string[];
  runway_details?: RunwayDetail[];
  frequencies?: Array<{ type: string; value: string }>;
  lastUpdated?: Date;
}
