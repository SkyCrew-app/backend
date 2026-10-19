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

// One direction of a runway (a QFU): "07R" of "07R/25L".
export interface BundleRunwayEnd {
  designator: string;
  trueBearingDeg: number | null;
  // AIXM Rdn/valMagBrg: the QFU as published.
  magneticBearingDeg: number | null;
  // Declared distances, m: AIXM Rdd (TORA, TODA, ASDA, LDA); the LDA also
  // from XML SIA Rwy/Lda1, Lda2 when the AIXM file is not there.
  toraM: number | null;
  todaM: number | null;
  asdaM: number | null;
  ldaM: number | null;
  thresholdElevationFt: number | null;
  displacedThreshold: boolean;
  // Rwy/RemDecDist1, 2: why the distances are reduced.
  remarks: string | null;
}

export interface BundleRunway {
  designator: string;
  trueHeadingDeg: number | null;
  lengthM: number | null;
  widthM: number | null;
  surface: string | null;
  // Absent from bundles built before the declared distances.
  main?: boolean;
  ends?: BundleRunwayEnd[];
}

// What a pilot reads in AD 2 of the aerodrome, raw as the SIA writes it
// (bilingual texts keep their "#" and "\\": see siaInLanguage).
export interface BundleAerodromeInfo {
  // AdStatut: CAP (open to public air traffic), RST (restricted use), PRV
  // (private), MIL (military), OFF (not an aerodrome: CROSS, ACC...).
  status: string | null;
  // TfcVfr, TfcIfr, TfcPrive: oui / non.
  vfr: boolean | null;
  ifr: boolean | null;
  privateFlights: boolean | null;
  magneticVariationDeg: number | null;
  magneticVariationYear: string | null;
  atsHoursCode: string | null;
  atsHours: string | null;
  fuelHours: string | null;
  fuel: string | null;
  fuelRemarks: string | null;
  // 100LL, UL91, JET A1... read from SvcEscaleFuel.
  fuelTypes: string[];
  remarks: string | null;
  phone: string | null;
  operator: string | null;
  // AdAd2: the aerodrome has a page in AD 2 of the AIP.
  ad2: boolean;
  // Whether the VAC of the cycle answered when the bundle was built
  // (navdata:build --check-vac); absent when not checked.
  vac?: boolean;
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
    info?: BundleAerodromeInfo;
  } | null;
}

// An obstacle of the SIA (ObstacleS, metropolitan France).
export interface BundleObstacle {
  ident: string;
  // TypeObst: "Eolienne(s)", "Pylône", "Mât"...
  type: string;
  lat: number;
  lon: number;
  amslFt: number;
  aglFt: number | null;
  count: number;
  // Balisage: "jour et nuit", "jour", "nuit", "non balisé".
  lighting: string | null;
  remark: string | null;
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
  // Volume/HorTxt; absent from bundles built before it was kept apart.
  hours?: string | null;
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
  // Absent from bundles built before the obstacles were imported.
  obstacles?: BundleObstacle[];
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
