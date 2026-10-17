import {
  AirspaceType,
  AltitudeLimit,
  RadioFrequency,
} from '../../navplan/engine/airspace-intersection';
import { NavPointType } from '../../navplan/engine/engine';

// The normalised navigation data of one AIRAC cycle, as built from the SIA
// export and OurAirports and as imported into each installation.
// Schema 2: airspaces whose outline is unknown have an empty geometry (a
// schema 1 bundle with SIA data drew them as 1 km circles: refused).
export const BUNDLE_SCHEMA = 2;
export const UNKNOWN_OUTLINE_COUNT = 'airspace unknown outline';

export type PointSource = 'SIA' | 'OURAIRPORTS' | 'CLUB';

export interface BundleRunway {
  designator: string;
  trueHeadingDeg: number | null;
  lengthM: number | null;
  widthM: number | null;
  surface: string | null;
}

export interface BundlePoint {
  type: Exclude<NavPointType, 'USER'>;
  ident: string;
  name: string | null;
  lat: number;
  lon: number;
  elevationFt: number | null;
  frequency: string | null;
  country: string | null;
  aerodromeIcao: string | null;
  mandatory: boolean | null;
  source: PointSource;
  sourceId: string | null;
  extra: {
    runways?: BundleRunway[];
    frequencies?: RadioFrequency[];
    status?: string | null;
    description?: string | null;
  } | null;
}

export interface BundleAirspace {
  sourceId: string;
  name: string;
  type: AirspaceType;
  icaoClass: string | null;
  floor: AltitudeLimit;
  ceiling: AltitudeLimit;
  activity: string | null;
  scheduleCode: string | null;
  frequencies: RadioFrequency[];
  remarks: string | null;
  // GeoJSON MultiPolygon coordinates, [lon, lat]; empty when the outline is
  // not published (géométrie inconnue).
  geometry: number[][][][];
  // Without an outline: the point the SIA gives, null when it cannot be
  // located (defined in words).
  referencePoint?: { lat: number; lon: number } | null;
}

export interface NavdataBundle {
  schema: number;
  airac: string;
  effectiveFrom: string; // ISO date
  effectiveTo: string;
  // Attribution shown with the data.
  source: string;
  builtAt: string;
  sources: {
    sia?: {
      file: string;
      effectiveDate: string | null;
      version: string | null;
    };
    ourAirports?: { downloadedAt: string };
  };
  points: BundlePoint[];
  airspaces: BundleAirspace[];
}

export interface ImportReport {
  counts: Record<string, number>;
  skipped: Record<string, number>;
  warnings: string[];
  errors: string[];
}

export const emptyReport = (): ImportReport => ({
  counts: {},
  skipped: {},
  warnings: [],
  errors: [],
});

export const bump = (record: Record<string, number>, key: string, by = 1) => {
  record[key] = (record[key] ?? 0) + by;
};
