import { runwayEndsOf, RunwayData, RunwayWind } from './aerodrome';
import { CheckStatus, MessageRef, worstStatus } from './types';

// Take-off and landing distances against the declared distances of each
// runway direction.
//
// The aircraft's flight manual table (pressure altitude x temperature, and
// mass when it gives several) is interpolated linearly, never extrapolated:
//   - above the table (higher, hotter, heavier) the value at its edge is
//     used and the result is a WARNING "outside the manual's table";
//   - below it (lower, colder, lighter) the value at its edge is larger
//     than the real one: it is used as it is, which is conservative.
// Corrections: the manual's own when entered, else the generic factors of
// the UK CAA Safety Sense Leaflet 7 "Aeroplane Performance", named as such
// in the result. With the manual's per-knot wind correction only 50 % of a
// head wind is credited and 150 % of a tail wind is applied; without it no
// head wind is credited. Then the club's safety factor (the leaflet
// recommends 1.33 for the take-off and 1.43 for the landing).
//
// Compared with: TORA (ground roll) and TODA (to 15 m) for the take-off,
// LDA (from 15 m) for the landing. BLOCKING when the factored distance
// exceeds what is available, WARNING within 10 % of it. Without a table:
// WARNING, never OK.

export interface DistanceRow {
  pressureAltFt: number;
  temperatureC: number;
  // Null: the table's reference mass.
  massKg?: number | null;
  groundRollM: number;
  // Take-off: to 15 m (50 ft); landing: from 15 m.
  distance15mM: number;
}

export interface RunwayDistanceTable {
  rows: DistanceRow[];
  // Mass of the rows without one (usually the maximum mass).
  referenceMassKg: number | null;
  // Lift-off speed (take-off) or speed at 15 m (landing), kt IAS: for the
  // generic tail wind factor (a tail wind of 10 % of it adds 20 %).
  speedKt?: number | null;
  // The manual's own corrections, % of the distance; null: not given.
  headwindPercentPerKt?: number | null;
  tailwindPercentPerKt?: number | null;
  grassPercent?: number | null;
  wetGrassPercent?: number | null;
  // Per 1 % of slope (up for the take-off, down for the landing).
  slopePercentPerPercent?: number | null;
  source?: string | null;
}

export type DistanceKind = 'TAKEOFF' | 'LANDING';
export type RunwaySurfaceKind = 'PAVED' | 'GRASS' | 'UNPAVED' | 'UNKNOWN';
export type FactorSource = 'MANUAL' | 'CAA_SSL7' | 'CLUB';

// UK CAA Safety Sense Leaflet 7, "Aeroplane Performance".
export const CAA_FACTORS = {
  TAKEOFF: {
    grass: 1.2,
    wetGrass: 1.3,
    slopePer2Percent: 1.1,
    tailwind10Percent: 1.2,
  },
  LANDING: {
    grass: 1.15,
    wetGrass: 1.35,
    slopePer2Percent: 1.1,
    tailwind10Percent: 1.2,
  },
} as const;
export const DEFAULT_TAKEOFF_SAFETY_FACTOR = 1.33;
export const DEFAULT_LANDING_SAFETY_FACTOR = 1.43;
// Headwind credited, tail wind applied with the manual's per-knot factor.
export const HEADWIND_CREDIT = 0.5;
export const TAILWIND_PENALTY = 1.5;
// Within this share of what is available: WARNING.
export const DISTANCE_WARNING_RATIO = 0.9;

export interface DistanceFactor {
  // A key of the API dictionaries (navplan.distance.factor.*).
  code: string;
  factor: number;
  source: FactorSource;
}

export interface Interpolated {
  groundRollM: number;
  distance15mM: number;
  // Hotter, higher or heavier than the table: its edge was used.
  outOfTable: boolean;
}

// ---------- Interpolation ----------

const bracket = (values: number[], x: number) => {
  if (x <= values[0])
    return { lo: values[0], hi: values[0], t: 0, above: false };
  const last = values[values.length - 1];
  if (x >= last) return { lo: last, hi: last, t: 0, above: x > last };
  let i = 0;
  while (values[i + 1] < x) i++;
  const lo = values[i];
  const hi = values[i + 1];
  return { lo, hi, t: (x - lo) / (hi - lo), above: false };
};

const sortedUnique = (values: number[]) =>
  [...new Set(values)].sort((a, b) => a - b);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function interpolateGroup(
  rows: DistanceRow[],
  pressureAltFt: number,
  temperatureC: number,
): Interpolated {
  const altitudes = sortedUnique(rows.map((r) => r.pressureAltFt));
  const pa = bracket(altitudes, pressureAltFt);
  let outOfTable = pa.above;
  const atAltitude = (altitude: number) => {
    const line = rows
      .filter((r) => r.pressureAltFt === altitude)
      .sort((a, b) => a.temperatureC - b.temperatureC);
    const temps = line.map((r) => r.temperatureC);
    const t = bracket(temps, temperatureC);
    outOfTable = outOfTable || t.above;
    const lo = line[temps.indexOf(t.lo)];
    const hi = line[temps.indexOf(t.hi)];
    return {
      groundRollM: lerp(lo.groundRollM, hi.groundRollM, t.t),
      distance15mM: lerp(lo.distance15mM, hi.distance15mM, t.t),
    };
  };
  const lo = atAltitude(pa.lo);
  const hi = atAltitude(pa.hi);
  return {
    groundRollM: lerp(lo.groundRollM, hi.groundRollM, pa.t),
    distance15mM: lerp(lo.distance15mM, hi.distance15mM, pa.t),
    outOfTable,
  };
}

// Multi-linear interpolation over pressure altitude x temperature (x mass
// when the table gives several). Null without a row.
export function interpolateDistances(
  table: RunwayDistanceTable,
  pressureAltFt: number,
  temperatureC: number,
  massKg: number | null,
): Interpolated | null {
  const rows = (table.rows ?? []).filter(
    (r) =>
      Number.isFinite(r.pressureAltFt) &&
      Number.isFinite(r.temperatureC) &&
      Number.isFinite(r.groundRollM) &&
      Number.isFinite(r.distance15mM),
  );
  if (rows.length === 0) return null;
  const massOf = (row: DistanceRow) => row.massKg ?? table.referenceMassKg;
  const masses = sortedUnique(
    rows.map(massOf).filter((m): m is number => m != null),
  );
  if (masses.length === 0) {
    // A table without any mass: valid for its aircraft at any mass.
    return interpolateGroup(rows, pressureAltFt, temperatureC);
  }
  // Unknown mass: the heaviest of the table.
  const m = bracket(masses, massKg ?? masses[masses.length - 1]);
  const groupAt = (mass: number) =>
    interpolateGroup(
      rows.filter((r) => (massOf(r) ?? mass) === mass),
      pressureAltFt,
      temperatureC,
    );
  const lo = groupAt(m.lo);
  const hi = m.hi === m.lo ? lo : groupAt(m.hi);
  return {
    groundRollM: lerp(lo.groundRollM, hi.groundRollM, m.t),
    distance15mM: lerp(lo.distance15mM, hi.distance15mM, m.t),
    outOfTable: m.above || lo.outOfTable || hi.outOfTable,
  };
}

// ---------- Runway surface and conditions ----------

const plain = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// The SIA gives "revêtue" / "non revêtue" or the material ("béton
// bitumineux", "gazon"); OurAirports codes (ASP, GRS, CON, PEM...) or
// free text (Grass, Asphalt, Turf...). A surface with grass anywhere
// ("CONC+GRS", "grass/asphalt") counts as grass.
export function runwaySurfaceKind(
  surface: string | null | undefined,
): RunwaySurfaceKind {
  const text = plain(surface ?? '');
  if (!text) return 'UNKNOWN';
  if (/\bnon[ -]?revetu|\bunpaved\b/.test(text)) return 'UNPAVED';
  if (
    /\b(grs|grass|gras|gazon|herbe?|herba|erba|turf|sod|gre|g)\b|grass/.test(
      text,
    )
  )
    return 'GRASS';
  if (
    /\b(asp|asph|ashp|asphalte?|asfalt|tarmac|bitume?|bitumineux|enrobe|beton|concrete|conc|con|pem|paved|revetue?|macadam|mac|hydrocarbone|resine|hard|a)\b|asphalt|concrete|bitum|beton/.test(
      text,
    )
  )
    return 'PAVED';
  if (
    /earth|dirt|ground|sand|gravel|gvl|soil|rough|hardcore|terre|san\b/.test(
      text,
    )
  )
    return 'UNPAVED';
  return 'UNKNOWN';
}

// Slope of a runway direction, % (positive: up hill from its threshold),
// from the threshold elevations of both ends.
export function runwaySlopePercent(
  runway: RunwayData,
  designator: string,
): number | null {
  const ends = runwayEndsOf(runway);
  const end = ends.find((e) => e.designator === designator);
  const other = ends.find((e) => e.designator !== designator);
  const length = runway.lengthM ?? end?.toraM ?? null;
  if (
    !end ||
    !other ||
    end.thresholdElevationFt == null ||
    other.thresholdElevationFt == null ||
    !length
  )
    return null;
  return (
    Math.round(
      (((other.thresholdElevationFt - end.thresholdElevationFt) * 0.3048) /
        length) *
        1000,
    ) / 10
  );
}

// ---------- Required distances ----------

export interface DistanceConditions {
  pressureAltFt: number;
  temperatureC: number;
  massKg: number | null;
  // Positive: head wind; negative: tail wind; null: unknown.
  headwindKt: number | null;
  surface: RunwaySurfaceKind;
  wet: boolean;
  // Positive: up hill in the direction of the take-off or landing.
  slopePercent: number | null;
}

export interface RequiredDistances {
  tableGroundRollM: number | null;
  tableDistance15mM: number | null;
  factors: DistanceFactor[];
  requiredGroundRollM: number | null;
  requiredDistance15mM: number | null;
  outOfTable: boolean;
  messages: MessageRef[];
  status: CheckStatus;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

export function requiredDistances(
  kind: DistanceKind,
  table: RunwayDistanceTable | null | undefined,
  conditions: DistanceConditions,
  safetyFactor: number,
): RequiredDistances {
  const messages: MessageRef[] = [];
  const statuses: CheckStatus[] = ['OK'];
  const interpolated = table
    ? interpolateDistances(
        table,
        conditions.pressureAltFt,
        conditions.temperatureC,
        conditions.massKg,
      )
    : null;
  if (!table || !interpolated) {
    return {
      tableGroundRollM: null,
      tableDistance15mM: null,
      factors: [],
      requiredGroundRollM: null,
      requiredDistance15mM: null,
      outOfTable: false,
      messages: [{ key: 'navplan.distance.noTable' }],
      status: 'WARNING',
    };
  }
  if (interpolated.outOfTable) {
    messages.push({ key: 'navplan.distance.outOfTable' });
    statuses.push('WARNING');
  }
  const caa = CAA_FACTORS[kind];
  const factors: DistanceFactor[] = [];
  const add = (code: string, factor: number, source: FactorSource) => {
    if (Math.abs(factor - 1) > 1e-9)
      factors.push({ code, factor: round3(factor), source });
  };

  // Surface.
  const grassLike = conditions.surface !== 'PAVED';
  if (conditions.surface === 'UNPAVED' || conditions.surface === 'UNKNOWN')
    messages.push({
      key:
        conditions.surface === 'UNPAVED'
          ? 'navplan.distance.unpavedAsGrass'
          : 'navplan.distance.surfaceUnknown',
    });
  if (grassLike) {
    if (conditions.wet) {
      if (table.wetGrassPercent != null)
        add('wetGrass', 1 + table.wetGrassPercent / 100, 'MANUAL');
      else add('wetGrass', caa.wetGrass, 'CAA_SSL7');
    } else if (table.grassPercent != null)
      add('grass', 1 + table.grassPercent / 100, 'MANUAL');
    else add('grass', caa.grass, 'CAA_SSL7');
  }

  // Slope: up hill for the take-off, down hill for the landing; the other
  // way is not credited.
  if (conditions.slopePercent === null) {
    messages.push({ key: 'navplan.distance.slopeUnknown' });
  } else {
    const adverse =
      kind === 'TAKEOFF'
        ? Math.max(0, conditions.slopePercent)
        : Math.max(0, -conditions.slopePercent);
    if (adverse > 0) {
      if (table.slopePercentPerPercent != null)
        add(
          'slope',
          1 + (table.slopePercentPerPercent / 100) * adverse,
          'MANUAL',
        );
      else
        add(
          'slope',
          1 + ((caa.slopePer2Percent - 1) / 2) * adverse,
          'CAA_SSL7',
        );
    }
  }

  // Wind.
  const wind = conditions.headwindKt;
  if (wind === null) {
    messages.push({ key: 'navplan.distance.windUnknown' });
  } else if (wind > 0) {
    if (table.headwindPercentPerKt != null)
      add(
        'headwind',
        Math.max(
          0.5,
          1 - (table.headwindPercentPerKt / 100) * HEADWIND_CREDIT * wind,
        ),
        'MANUAL',
      );
  } else if (wind < 0) {
    const tail = -wind;
    if (table.tailwindPercentPerKt != null)
      add(
        'tailwind',
        1 + (table.tailwindPercentPerKt / 100) * TAILWIND_PENALTY * tail,
        'MANUAL',
      );
    else if (table.speedKt)
      add(
        'tailwind',
        1 + (caa.tailwind10Percent - 1) * (tail / (0.1 * table.speedKt)),
        'CAA_SSL7',
      );
    else {
      messages.push({
        key: 'navplan.distance.tailwindNotCorrected',
        params: { tailwind: tail },
      });
      statuses.push('WARNING');
    }
  }

  add('safety', safetyFactor, 'CLUB');
  const product = factors.reduce((p, f) => p * f.factor, 1);
  return {
    tableGroundRollM: Math.round(interpolated.groundRollM),
    tableDistance15mM: Math.round(interpolated.distance15mM),
    factors,
    requiredGroundRollM: Math.ceil(interpolated.groundRollM * product),
    requiredDistance15mM: Math.ceil(interpolated.distance15mM * product),
    outOfTable: interpolated.outOfTable,
    messages,
    status: worstStatus(...statuses),
  };
}

// ---------- Per runway direction ----------

export interface RunwayDistanceResult {
  designator: string;
  // The direction most into the wind (else the longest).
  suggested: boolean;
  surface: RunwaySurfaceKind;
  surfaceText: string | null;
  wet: boolean;
  slopePercent: number | null;
  headwindKt: number | null;
  tableGroundRollM: number | null;
  tableDistance15mM: number | null;
  factors: DistanceFactor[];
  requiredGroundRollM: number | null;
  requiredDistance15mM: number | null;
  // Take-off: TORA and TODA; landing: LDA (availableRunM null).
  availableRunM: number | null;
  availableDistanceM: number | null;
  // Smallest of available - required (m).
  marginM: number | null;
  status: CheckStatus;
  messages: MessageRef[];
}

export type ConditionsSource = 'METAR' | 'ISA';
export type MassSource = 'MASS_BALANCE' | 'MAXIMUM' | 'TABLE' | 'UNKNOWN';

export interface AerodromeDistances {
  kind: DistanceKind;
  massKg: number | null;
  massSource: MassSource;
  pressureAltitudeFt: number;
  temperatureC: number;
  conditionsSource: ConditionsSource;
  safetyFactor: number;
  dataMissing: boolean;
  tableSource: string | null;
  runways: RunwayDistanceResult[];
  // The suggested runway's.
  status: CheckStatus;
  messages: MessageRef[];
}

const compare = (
  required: number | null,
  available: number | null,
): { margin: number | null; status: CheckStatus } => {
  if (required === null) return { margin: null, status: 'WARNING' };
  if (available === null || available <= 0)
    return { margin: null, status: 'WARNING' };
  return {
    margin: available - required,
    status:
      required > available
        ? 'BLOCKING'
        : required > available * DISTANCE_WARNING_RATIO
          ? 'WARNING'
          : 'OK',
  };
};

export interface AerodromeDistanceInput {
  kind: DistanceKind;
  runways: RunwayData[];
  elevationFt: number;
  pressureAltitudeOf: (elevationFt: number) => number;
  temperatureC: number;
  conditionsSource: ConditionsSource;
  massKg: number | null;
  massSource: MassSource;
  winds: RunwayWind[];
  // Wind component on every direction when the METAR wind has no
  // direction: 0 when calm, minus the speed (a tail wind) when variable.
  uniformHeadwindKt?: number | null;
  wet: boolean;
  table: RunwayDistanceTable | null | undefined;
  safetyFactor: number;
}

export function aerodromeDistances(
  input: AerodromeDistanceInput,
): AerodromeDistances {
  const messages: MessageRef[] = [];
  const statuses: CheckStatus[] = [];
  const tableMass =
    input.table && input.massKg === null
      ? (Math.max(
          ...(input.table.rows ?? []).map(
            (r) => r.massKg ?? input.table!.referenceMassKg ?? -Infinity,
          ),
          -Infinity,
        ) as number)
      : null;
  if (input.conditionsSource === 'ISA') {
    messages.push({ key: 'navplan.distance.isaConditions' });
    statuses.push('WARNING');
  }
  if (input.massSource === 'MAXIMUM')
    messages.push({ key: 'navplan.distance.massMaximum' });
  if (input.massSource === 'TABLE' || input.massSource === 'UNKNOWN') {
    messages.push({ key: 'navplan.distance.massUnknown' });
    statuses.push('WARNING');
  }
  const pressureAltitudeFt = Math.round(
    input.pressureAltitudeOf(input.elevationFt),
  );
  const results: RunwayDistanceResult[] = [];
  for (const runway of input.runways) {
    for (const end of runwayEndsOf(runway)) {
      const wind = input.winds.find((w) => w.designator === end.designator);
      const surface = runwaySurfaceKind(runway.surface);
      const slope = runwaySlopePercent(runway, end.designator);
      const elevation = end.thresholdElevationFt ?? input.elevationFt;
      const required = requiredDistances(
        input.kind,
        input.table,
        {
          pressureAltFt: input.pressureAltitudeOf(elevation),
          temperatureC: input.temperatureC,
          massKg:
            input.massKg ?? (Number.isFinite(tableMass) ? tableMass : null),
          headwindKt: wind
            ? wind.headwindKt
            : (input.uniformHeadwindKt ?? null),
          surface,
          wet: input.wet,
          slopePercent: slope,
        },
        input.safetyFactor,
      );
      const takeoff = input.kind === 'TAKEOFF';
      const availableRun = takeoff ? (end.toraM ?? runway.lengthM) : null;
      const availableDistance = takeoff
        ? (end.todaM ?? end.toraM ?? runway.lengthM)
        : (end.ldaM ?? runway.lengthM);
      const runCheck = takeoff
        ? compare(required.requiredGroundRollM, availableRun)
        : null;
      const distanceCheck = compare(
        required.requiredDistance15mM,
        availableDistance,
      );
      const runwayMessages = [...required.messages];
      if (
        required.requiredDistance15mM !== null &&
        (availableDistance === null || (takeoff && availableRun === null))
      )
        runwayMessages.push({ key: 'navplan.distance.availableUnknown' });
      else if ((takeoff && end.toraM == null) || (!takeoff && end.ldaM == null))
        runwayMessages.push({ key: 'navplan.distance.lengthAsDeclared' });
      const margins = [runCheck?.margin, distanceCheck.margin].filter(
        (m): m is number => m != null,
      );
      results.push({
        designator: end.designator,
        suggested: !!wind?.best,
        surface,
        surfaceText: runway.surface,
        wet: input.wet,
        slopePercent: slope,
        headwindKt: wind ? wind.headwindKt : (input.uniformHeadwindKt ?? null),
        tableGroundRollM: required.tableGroundRollM,
        tableDistance15mM: required.tableDistance15mM,
        factors: required.factors,
        requiredGroundRollM: required.requiredGroundRollM,
        requiredDistance15mM: required.requiredDistance15mM,
        availableRunM: availableRun,
        availableDistanceM: availableDistance,
        marginM: margins.length ? Math.min(...margins) : null,
        status: worstStatus(
          required.status,
          distanceCheck.status,
          ...(runCheck ? [runCheck.status] : []),
          ...statuses,
        ),
        messages: runwayMessages,
      });
    }
  }
  // Without a wind, the longest direction is suggested.
  if (results.length > 0 && !results.some((r) => r.suggested)) {
    results.reduce(
      (a, b) =>
        (b.availableDistanceM ?? 0) > (a.availableDistanceM ?? 0) ? b : a,
      results[0],
    ).suggested = true;
  }
  const suggested = results.find((r) => r.suggested) ?? null;
  if (results.length === 0) {
    messages.push({ key: 'navplan.distance.noRunway' });
    statuses.push('WARNING');
  }
  return {
    kind: input.kind,
    massKg:
      input.massKg !== null
        ? Math.round(input.massKg)
        : Number.isFinite(tableMass)
          ? tableMass
          : null,
    massSource: input.massSource,
    pressureAltitudeFt,
    temperatureC: Math.round(input.temperatureC * 10) / 10,
    conditionsSource: input.conditionsSource,
    safetyFactor: input.safetyFactor,
    dataMissing: !input.table || (input.table.rows ?? []).length === 0,
    tableSource: input.table?.source ?? null,
    runways: results,
    status: worstStatus(...statuses, suggested ? suggested.status : 'WARNING'),
    messages,
  };
}
