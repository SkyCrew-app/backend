export interface NavaidData {
  ident: string;
  name: string;
  type: 'VOR' | 'NDB' | 'FIX';
  country: string;
  lat: number;
  lon: number;
}

export interface AirspaceZoneData {
  id: string;
  name: string;
  class: string;
  floor_ft: number;
  ceiling_ft: number;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}
