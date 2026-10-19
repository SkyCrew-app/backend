import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import {
  AirspaceRelationEnum,
  AirspaceTypeEnum,
  AltitudeRefEnum,
  CheckStatusEnum,
  DataSourceKindEnum,
  EnvelopeCategoryEnum,
  FlightPhaseEnum,
  FuelTypeEnum,
  NavPointTypeEnum,
  ReserveCaseEnum,
  StationKindEnum,
} from './enums';

// Output types of the flight preparation contract (design § 3.2). Units are
// in the field names: kt, NM, ft, L, kg, m, minutes, degrees.

@ObjectType()
export class NavdataInfo {
  @Field() airac: string;
  @Field() effectiveFrom: Date;
  @Field() effectiveTo: Date;
  @Field() stale: boolean;
  @Field() source: string;
}

@ObjectType()
export class AltitudeLimit {
  @Field(() => AltitudeRefEnum) ref: AltitudeRefEnum;
  @Field(() => Int) value: number;
  @Field() label: string;
}

@ObjectType()
export class NavPoint {
  @Field(() => ID) id: string;
  @Field(() => NavPointTypeEnum) type: NavPointTypeEnum;
  @Field() ident: string;
  @Field(() => String, { nullable: true }) name: string | null;
  @Field(() => Float) lat: number;
  @Field(() => Float) lon: number;
  @Field(() => Int, { nullable: true }) elevationFt: number | null;
  @Field(() => String, { nullable: true }) frequency: string | null;
  @Field(() => String, { nullable: true }) aerodromeIcao: string | null;
  @Field(() => Boolean, { nullable: true }) mandatory: boolean | null;
}

@ObjectType()
export class GeoPoint {
  @Field(() => Float) lat: number;
  @Field(() => Float) lon: number;
}

// One direction of a runway (QFU) with its declared distances (AIXM Rdd;
// LDA also from the XML SIA): what is usable, not the physical length.
@ObjectType()
export class RunwayEnd {
  @Field() designator: string;
  @Field(() => Float, { nullable: true }) trueBearingDeg: number | null;
  @Field(() => Float, { nullable: true }) magneticBearingDeg: number | null;
  @Field(() => Int, { nullable: true }) toraM: number | null;
  @Field(() => Int, { nullable: true }) todaM: number | null;
  @Field(() => Int, { nullable: true }) asdaM: number | null;
  @Field(() => Int, { nullable: true }) ldaM: number | null;
  @Field(() => Int, { nullable: true }) thresholdElevationFt: number | null;
  @Field() displacedThreshold: boolean;
  // Why the distances are reduced (SIA RemDecDist).
  @Field(() => String, { nullable: true }) remarks: string | null;
}

@ObjectType()
export class Runway {
  @Field() designator: string;
  @Field(() => Float, { nullable: true }) trueHeadingDeg: number | null;
  @Field(() => Int, { nullable: true }) lengthM: number | null;
  @Field(() => Int, { nullable: true }) widthM: number | null;
  @Field(() => String, { nullable: true }) surface: string | null;
  @Field(() => Boolean, { nullable: true }) main: boolean | null;
  @Field(() => [RunwayEnd]) ends: RunwayEnd[];
}

@ObjectType()
export class RadioFrequency {
  @Field() service: string;
  @Field(() => String, { nullable: true }) callsign: string | null;
  @Field() mhz: string;
  // H24, HO, HX, HJ, NOTAM; with the published text.
  @Field(() => String, { nullable: true }) hoursCode: string | null;
  @Field(() => String, { nullable: true }) hours: string | null;
  // Coverage, sector, "Absence ATS"...
  @Field(() => String, { nullable: true }) remark: string | null;
  // An auxiliary frequency of the service (SIA "supplétive").
  @Field(() => Boolean, { nullable: true }) auxiliary: boolean | null;
}

// AD 2 data of an aerodrome (SIA), texts in the language of the request.
@ObjectType()
export class AerodromeSheet {
  @Field() icao: string;
  @Field(() => String, { nullable: true }) name: string | null;
  @Field(() => Int, { nullable: true }) elevationFt: number | null;
  // SIA, OURAIRPORTS or CLUB.
  @Field() source: string;
  // CAP (open to public air traffic), RST (restricted use), PRV (private),
  // MIL (military), OFF (not an aerodrome); null when unknown.
  @Field(() => String, { nullable: true }) status: string | null;
  @Field(() => Boolean, { nullable: true }) vfr: boolean | null;
  @Field(() => Boolean, { nullable: true }) ifr: boolean | null;
  @Field(() => Boolean, { nullable: true }) privateFlights: boolean | null;
  @Field(() => Float, { nullable: true })
  magneticVariationDeg: number | null;
  @Field(() => String, { nullable: true })
  magneticVariationYear: string | null;
  @Field(() => String, { nullable: true }) atsHoursCode: string | null;
  @Field(() => String, { nullable: true }) atsHours: string | null;
  @Field(() => String, { nullable: true }) fuelHours: string | null;
  @Field(() => String, { nullable: true }) fuel: string | null;
  @Field(() => String, { nullable: true }) fuelRemarks: string | null;
  @Field(() => [String]) fuelTypes: string[];
  @Field(() => String, { nullable: true }) remarks: string | null;
  @Field(() => String, { nullable: true }) phone: string | null;
  @Field(() => String, { nullable: true }) operator: string | null;
  @Field(() => [Runway]) runways: Runway[];
  @Field(() => [RadioFrequency]) frequencies: RadioFrequency[];
  // The VAC PDF of the cycle in the SIA eAIP; null when none is known.
  @Field(() => String, { nullable: true }) vacUrl: string | null;
  @Field() chartsUrl: string;
  // What the nav log prints for it (tower, AFIS or A/A, see the API rule).
  @Field(() => String, { nullable: true }) navLogFrequency: string | null;
}

@ObjectType()
export class AerodromeDetails {
  @Field(() => NavPoint) point: NavPoint;
  @Field(() => AerodromeSheet) sheet: AerodromeSheet;
  @Field(() => [Runway]) runways: Runway[];
  @Field(() => [RadioFrequency]) frequencies: RadioFrequency[];
  @Field(() => Int, { nullable: true }) circuitHeightFt: number | null;
}

// An obstacle of the SIA, for the map.
@ObjectType()
export class Obstacle {
  @Field() ident: string;
  @Field() type: string;
  @Field(() => Float) lat: number;
  @Field(() => Float) lon: number;
  @Field(() => Int) amslFt: number;
  @Field(() => Int, { nullable: true }) aglFt: number | null;
  @Field(() => Int) count: number;
  @Field(() => String, { nullable: true }) lighting: string | null;
}

@ObjectType()
export class Airspace {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => AirspaceTypeEnum) type: AirspaceTypeEnum;
  @Field(() => String, { nullable: true }) icaoClass: string | null;
  @Field(() => AltitudeLimit) floor: AltitudeLimit;
  @Field(() => AltitudeLimit) ceiling: AltitudeLimit;
  @Field(() => String, { nullable: true }) activity: string | null;
  // Published hours (SIA HorTxt), apart from the activity.
  @Field(() => String, { nullable: true }) hours: string | null;
  @Field(() => [RadioFrequency]) frequencies: RadioFrequency[];
  @Field(() => String, { nullable: true }) remarks: string | null;
  @Field(() => GraphQLJSON) geometry: unknown;
  @Field() outlineKnown: boolean;
  // Without an outline: the published point (activities, protected areas).
  @Field(() => GeoPoint, { nullable: true }) referencePoint: GeoPoint | null;
  // For an activity published at a point: the distance the plans look
  // around it.
  @Field(() => Float, { nullable: true }) radiusNm: number | null;
}

// ---------- Aircraft data ----------
@ObjectType()
export class FuelTank {
  @Field() id: string;
  @Field() label: string;
  @Field(() => Float) usableL: number;
  @Field(() => Float) unusableL: number;
  @Field(() => Float) armM: number;
}

@ObjectType()
export class FuelData {
  @Field(() => FuelTypeEnum) type: FuelTypeEnum;
  @Field(() => Float) densityKgPerL: number;
  @Field(() => [FuelTank]) tanks: FuelTank[];
  @Field(() => Float) taxiFuelL: number;
  @Field(() => [String]) burnOrder: string[];
}

@ObjectType()
export class ClimbRow {
  @Field(() => Int) pressureAltFt: number;
  @Field(() => Float) timeMin: number;
  @Field(() => Float) fuelL: number;
  @Field(() => Float) distanceNm: number;
}

@ObjectType()
export class ClimbData {
  @Field(() => Int) iasKt: number;
  @Field(() => [ClimbRow], { nullable: true }) table: ClimbRow[] | null;
  @Field(() => Int, { nullable: true }) seaLevelRateFpm: number | null;
  @Field(() => Int, { nullable: true }) ceilingRateFpm: number | null;
  @Field(() => Float, { nullable: true }) fuelFlowLph: number | null;
}

@ObjectType()
export class CruiseRow {
  @Field(() => Int) pressureAltFt: number;
  @Field() setting: string;
  @Field(() => Int) isaDeviationC: number;
  @Field(() => Float) tasKt: number;
  @Field(() => Float) fuelFlowLph: number;
}

@ObjectType()
export class CruiseData {
  @Field() normalSetting: string;
  @Field(() => [CruiseRow]) rows: CruiseRow[];
}

@ObjectType()
export class DescentData {
  @Field(() => Int) iasKt: number;
  @Field(() => Int) rateFpm: number;
  @Field(() => Float) fuelFlowLph: number;
}

@ObjectType()
export class CalibrationRow {
  @Field(() => Float) iasKt: number;
  @Field(() => Float) casKt: number;
}

@ObjectType()
export class ReserveData {
  @Field(() => Float) holdingFuelFlowLph: number;
  @Field(() => Float) maxContinuousFuelFlowLph: number;
}

@ObjectType()
export class AircraftPerformance {
  @Field(() => Int) aircraftId: number;
  @Field(() => String, { nullable: true }) templateCode: string | null;
  @Field(() => FuelData) fuel: FuelData;
  @Field(() => ClimbData) climb: ClimbData;
  @Field(() => CruiseData) cruise: CruiseData;
  @Field(() => DescentData) descent: DescentData;
  @Field(() => ReserveData) reserve: ReserveData;
  @Field(() => Float) arrivalFuelL: number;
  @Field(() => Int, { nullable: true }) serviceCeilingFt: number | null;
  @Field(() => [CalibrationRow]) calibration: CalibrationRow[];
  @Field(() => String, { nullable: true }) source: string | null;
  @Field(() => Date, { nullable: true }) validatedAt: Date | null;
  @Field(() => String, { nullable: true }) validatedBy: string | null;
}

@ObjectType()
export class Station {
  @Field() id: string;
  @Field() label: string;
  @Field(() => StationKindEnum) kind: StationKindEnum;
  @Field(() => Float) armM: number;
  @Field(() => Float, { nullable: true }) maxKg: number | null;
  @Field(() => String, { nullable: true }) tankId: string | null;
}

@ObjectType()
export class CombinedLimit {
  @Field(() => [String]) stationIds: string[];
  @Field(() => Float) maxKg: number;
  @Field() label: string;
}

@ObjectType()
export class EnvelopePoint {
  @Field(() => Float) armM: number;
  @Field(() => Float) massKg: number;
}

@ObjectType()
export class Envelope {
  @Field(() => EnvelopeCategoryEnum) category: EnvelopeCategoryEnum;
  @Field(() => [EnvelopePoint]) points: EnvelopePoint[];
}

@ObjectType()
export class AircraftMassBalance {
  @Field(() => Int) aircraftId: number;
  @Field(() => Float, { nullable: true }) emptyMassKg: number | null;
  @Field(() => Float, { nullable: true }) emptyArmM: number | null;
  @Field(() => Date, { nullable: true }) weighingDate: Date | null;
  @Field(() => String, { nullable: true }) weighingRef: string | null;
  @Field(() => Float, { nullable: true }) mtowKg: number | null;
  @Field(() => Float, { nullable: true }) mlwKg: number | null;
  @Field(() => Float, { nullable: true }) mzfwKg: number | null;
  @Field(() => [Station]) stations: Station[];
  @Field(() => [CombinedLimit]) combinedLimits: CombinedLimit[];
  @Field(() => [Envelope]) envelopes: Envelope[];
  @Field(() => Date, { nullable: true }) validatedAt: Date | null;
  @Field(() => String, { nullable: true }) validatedBy: string | null;
}

@ObjectType()
export class AircraftTypeTemplate {
  @Field() code: string;
  @Field() label: string;
  @Field(() => String, { nullable: true }) source: string | null;
}

// ---------- Club settings ----------
@ObjectType()
export class FlightPlanningSettings {
  @Field(() => Int) reserveVfrDayLocalMin: number;
  @Field(() => Int) reserveVfrDayMin: number;
  @Field(() => Int) reserveVfrNightMin: number;
  @Field(() => Float) contingencyPercent: number;
  @Field(() => Float) contingencyMinL: number;
  @Field() alternateRequiredVfr: boolean;
  @Field(() => Int) clubMarginMin: number;
  @Field(() => Int) verticalMarginFt: number;
  @Field(() => Int) defaultCircuitHeightFt: number;
}

// ---------- Flight plan ----------
@ObjectType()
export class Wind {
  @Field(() => Int) directionDeg: number;
  @Field(() => Int) speedKt: number;
  @Field(() => Float, { nullable: true }) temperatureC: number | null;
  @Field(() => DataSourceKindEnum) source: DataSourceKindEnum;
  @Field(() => Date, { nullable: true }) validAt: Date | null;
}

@ObjectType()
export class PhaseSegment {
  @Field(() => FlightPhaseEnum) phase: FlightPhaseEnum;
  @Field(() => Float) fromNm: number;
  @Field(() => Float) toNm: number;
  @Field(() => Int) startAltFt: number;
  @Field(() => Int) endAltFt: number;
  @Field(() => Float) tasKt: number;
  @Field(() => Float) gsKt: number;
  @Field(() => Float) timeMin: number;
  @Field(() => Float) fuelL: number;
}

@ObjectType()
export class AirspaceCrossing {
  @Field(() => Airspace) airspace: Airspace;
  @Field(() => Float) entryNm: number;
  @Field(() => Float) exitNm: number;
  @Field(() => Int) aircraftMinAltFt: number;
  @Field(() => Int) aircraftMaxAltFt: number;
  @Field(() => AirspaceRelationEnum) relation: AirspaceRelationEnum;
  @Field(() => CheckStatusEnum) status: CheckStatusEnum;
  @Field() requirement: string;
  @Field() activityKnown: boolean;
}

// An area near the route whose outline is not published.
@ObjectType()
export class UnverifiedAirspace {
  @Field(() => Airspace) airspace: Airspace;
  // Distance from the route to its published point; null = not located.
  @Field(() => Float, { nullable: true }) distanceNm: number | null;
  @Field(() => CheckStatusEnum) status: CheckStatusEnum;
  @Field() message: string;
}

// Obstacles near a leg whose top is less than 500 ft below its altitude.
@ObjectType()
export class LegObstacle {
  @Field() type: string;
  @Field(() => Int) count: number;
  @Field() ident: string;
  @Field(() => Int) amslFt: number;
  @Field(() => Int, { nullable: true }) aglFt: number | null;
  @Field(() => Float) lat: number;
  @Field(() => Float) lon: number;
  @Field(() => String, { nullable: true }) lighting: string | null;
  @Field(() => Float) alongNm: number;
  @Field(() => Float) offsetNm: number;
  @Field(() => Int) marginFt: number;
  @Field(() => CheckStatusEnum) status: CheckStatusEnum;
}

@ObjectType()
export class Leg {
  @Field(() => Int) index: number;
  @Field(() => NavPoint) from: NavPoint;
  @Field(() => NavPoint) to: NavPoint;
  @Field(() => Float) distanceNm: number;
  @Field(() => Float) trueCourseDeg: number;
  @Field(() => Float) variationDeg: number;
  @Field(() => Float) magneticCourseDeg: number;
  @Field(() => Wind) wind: Wind;
  @Field(() => Float) windCorrectionDeg: number;
  @Field(() => Float) trueHeadingDeg: number;
  @Field(() => Float) magneticHeadingDeg: number;
  @Field(() => Float) tasKt: number;
  @Field(() => Float) groundSpeedKt: number;
  @Field(() => Int) altitudeFt: number;
  @Field(() => Int, { nullable: true }) suggestedAltitudeFt: number | null;
  @Field(() => [PhaseSegment]) segments: PhaseSegment[];
  @Field(() => Float) timeMin: number;
  @Field(() => Float) cumulativeTimeMin: number;
  @Field() eta: Date;
  @Field(() => Float) fuelL: number;
  @Field(() => Float) fuelRemainingL: number;
  @Field(() => [AirspaceCrossing]) crossings: AirspaceCrossing[];
  @Field(() => [LegObstacle]) obstacles: LegObstacle[];
  // Top of the highest obstacle within 2 NM of the leg, ft AMSL.
  @Field(() => Int, { nullable: true }) highestObstacleFt: number | null;
}

@ObjectType()
export class ProfilePoint {
  @Field(() => Float) distanceNm: number;
  @Field(() => Int) altitudeFt: number;
  @Field(() => String, { nullable: true }) label: string | null;
}

@ObjectType()
export class FuelPlan {
  // The pilot's case, or VFR_NIGHT when part of the flight is at night
  // (null on a plan saved before the night check).
  @Field(() => ReserveCaseEnum, { nullable: true })
  reserveCase: ReserveCaseEnum | null;
  @Field(() => Float) taxiL: number;
  @Field(() => Float) tripL: number;
  @Field(() => Float) contingencyL: number;
  @Field(() => Float) alternateL: number;
  @Field(() => Float) finalReserveL: number;
  @Field(() => Int) finalReserveMin: number;
  @Field(() => Float) clubMarginL: number;
  @Field(() => Float) minimumBlockL: number;
  @Field(() => Float) loadedL: number;
  @Field(() => Float) extraL: number;
  @Field(() => Float) landingL: number;
  @Field(() => Float, { nullable: true }) landingAtAlternateL: number | null;
  @Field(() => Float) usableL: number;
  @Field(() => Float) enduranceMin: number;
  @Field(() => CheckStatusEnum) status: CheckStatusEnum;
  @Field(() => [String]) messages: string[];
}

@ObjectType()
export class MassBalanceLine {
  @Field() stationId: string;
  @Field() label: string;
  @Field(() => Float) massKg: number;
  @Field(() => Float) armM: number;
  @Field(() => Float) momentKgm: number;
}

@ObjectType()
export class MassBalanceState {
  @Field(() => Float) massKg: number;
  @Field(() => Float) momentKgm: number;
  @Field(() => Float) cgM: number;
  @Field() withinEnvelope: boolean;
  @Field(() => Float) marginKg: number;
  @Field(() => Float) marginCgMm: number;
}

@ObjectType()
export class MassBalanceResult {
  @Field(() => [MassBalanceLine]) lines: MassBalanceLine[];
  @Field(() => MassBalanceState) takeoff: MassBalanceState;
  @Field(() => MassBalanceState) landing: MassBalanceState;
  @Field(() => MassBalanceState) zeroFuel: MassBalanceState;
  @Field(() => Envelope) envelope: Envelope;
  @Field(() => CheckStatusEnum) status: CheckStatusEnum;
  @Field(() => [String]) messages: string[];
}

@ObjectType()
export class Notice {
  @Field() code: string;
  @Field(() => CheckStatusEnum) status: CheckStatusEnum;
  @Field() message: string;
}

@ObjectType()
export class WeatherReport {
  @Field() icao: string;
  @Field(() => String, { nullable: true }) metar: string | null;
  @Field(() => String, { nullable: true }) taf: string | null;
  @Field(() => Date, { nullable: true }) observedAt: Date | null;
  @Field(() => Date, { nullable: true }) tafValidFrom: Date | null;
  @Field(() => Date, { nullable: true }) tafValidTo: Date | null;
}

// Twilight, sunrise and sunset (UTC) of an aerodrome of the plan, on the
// day of the flight there.
@ObjectType()
export class AerodromeSun {
  @Field() icao: string;
  // departure (off-block), destination (landing) or alternate (arrival).
  @Field() role: string;
  @Field() at: Date;
  @Field() date: string;
  @Field(() => Date, { nullable: true }) civilDawn: Date | null;
  @Field(() => Date, { nullable: true }) sunrise: Date | null;
  @Field(() => Date, { nullable: true }) sunset: Date | null;
  @Field(() => Date, { nullable: true }) civilDusk: Date | null;
}

@ObjectType()
export class Daylight {
  @Field(() => [AerodromeSun]) aerodromes: AerodromeSun[];
  // Part of the flight is in the aviation night (SERA).
  @Field() night: boolean;
  @Field(() => Date, { nullable: true }) nightFrom: Date | null;
}

// Wind components on a runway direction from the METAR wind (true).
@ObjectType()
export class RunwayWind {
  @Field() designator: string;
  // Positive: head wind; negative: tail wind.
  @Field(() => Int) headwindKt: number;
  // Positive: from the right; negative: from the left.
  @Field(() => Int) crosswindKt: number;
  @Field(() => Int, { nullable: true }) gustHeadwindKt: number | null;
  @Field(() => Int, { nullable: true }) gustCrosswindKt: number | null;
  @Field() best: boolean;
}

@ObjectType()
export class AerodromeConditions {
  @Field() station: string;
  @Field(() => Date, { nullable: true }) observedAt: Date | null;
  @Field(() => Int, { nullable: true }) windDirectionDeg: number | null;
  @Field(() => Int, { nullable: true }) windSpeedKt: number | null;
  @Field(() => Int, { nullable: true }) gustKt: number | null;
  @Field() windVariable: boolean;
  @Field(() => Int, { nullable: true }) temperatureC: number | null;
  @Field(() => Int, { nullable: true }) dewpointC: number | null;
  @Field(() => Int, { nullable: true }) qnhHpa: number | null;
  @Field(() => Int, { nullable: true }) pressureAltitudeFt: number | null;
  @Field(() => Int, { nullable: true }) densityAltitudeFt: number | null;
  @Field(() => [RunwayWind]) runways: RunwayWind[];
}

@ObjectType()
export class PlanAerodrome {
  // departure, destination or alternate.
  @Field() role: string;
  @Field() icao: string;
  @Field(() => AerodromeSheet, { nullable: true })
  sheet: AerodromeSheet | null;
  @Field(() => AerodromeConditions, { nullable: true })
  conditions: AerodromeConditions | null;
}

// The 0 °C isotherm from the winds aloft forecast.
@ObjectType()
export class FreezingLevel {
  // DEPARTURE, ROUTE (middle of the route) or DESTINATION.
  @Field() place: string;
  @Field(() => String, { nullable: true }) ident: string | null;
  @Field() at: Date;
  @Field(() => Int, { nullable: true }) altitudeFt: number | null;
  // LEVEL, SURFACE (0 °C or less at the ground), ABOVE (above topFt, the
  // top of the forecast) or UNKNOWN.
  @Field() state: string;
  @Field(() => Int, { nullable: true }) topFt: number | null;
}

@ObjectType()
export class FlightPlanResult {
  @Field(() => [Leg]) legs: Leg[];
  @Field(() => Leg, { nullable: true }) alternateLeg: Leg | null;
  @Field(() => [ProfilePoint]) profile: ProfilePoint[];
  @Field(() => Float) totalDistanceNm: number;
  @Field(() => Float) totalTimeMin: number;
  @Field(() => FuelPlan) fuel: FuelPlan;
  @Field(() => MassBalanceResult) massBalance: MassBalanceResult;
  @Field(() => [WeatherReport]) weather: WeatherReport[];
  @Field() windSource: string;
  @Field(() => NavdataInfo) navdata: NavdataInfo;
  @Field() engineVersion: string;
  @Field(() => CheckStatusEnum) status: CheckStatusEnum;
  @Field(() => [Notice]) notices: Notice[];
  @Field(() => [UnverifiedAirspace])
  unverifiedAirspaces: UnverifiedAirspace[];
  @Field() encodedPolyline: string;
  // QNH the plan was computed with: the pilot's, the departure METAR's or standard.
  @Field(() => Float, { nullable: true }) qnhHpa: number | null;
  // INPUT, METAR or DEFAULT; with a METAR, its aerodrome and observation time.
  @Field(() => String, { nullable: true }) qnhSource: string | null;
  @Field(() => String, { nullable: true }) qnhStation: string | null;
  @Field(() => Date, { nullable: true }) qnhObservedAt: Date | null;
  // Null on a plan saved before the night check.
  @Field(() => Daylight, { nullable: true }) daylight: Daylight | null;
  // Empty on a plan saved before them.
  @Field(() => [PlanAerodrome]) aerodromes: PlanAerodrome[];
  @Field(() => [FreezingLevel]) freezingLevels: FreezingLevel[];
}

@ObjectType()
export class FlightPlan {
  @Field(() => Int) id: number;
  @Field(() => Int, { nullable: true }) flightId: number | null;
  @Field(() => GraphQLJSON) input: unknown;
  @Field(() => FlightPlanResult) result: FlightPlanResult;
  @Field() createdAt: Date;
  @Field() updatedAt: Date;
}
