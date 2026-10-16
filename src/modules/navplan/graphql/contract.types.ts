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
export class Runway {
  @Field() designator: string;
  @Field(() => Float, { nullable: true }) trueHeadingDeg: number | null;
  @Field(() => Int, { nullable: true }) lengthM: number | null;
  @Field(() => Int, { nullable: true }) widthM: number | null;
  @Field(() => String, { nullable: true }) surface: string | null;
}

@ObjectType()
export class RadioFrequency {
  @Field() service: string;
  @Field(() => String, { nullable: true }) callsign: string | null;
  @Field() mhz: string;
}

@ObjectType()
export class AerodromeDetails {
  @Field(() => NavPoint) point: NavPoint;
  @Field(() => [Runway]) runways: Runway[];
  @Field(() => [RadioFrequency]) frequencies: RadioFrequency[];
  @Field(() => Int, { nullable: true }) circuitHeightFt: number | null;
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
  @Field(() => [RadioFrequency]) frequencies: RadioFrequency[];
  @Field(() => String, { nullable: true }) remarks: string | null;
  @Field(() => GraphQLJSON) geometry: unknown;
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
}

@ObjectType()
export class ProfilePoint {
  @Field(() => Float) distanceNm: number;
  @Field(() => Int) altitudeFt: number;
  @Field(() => String, { nullable: true }) label: string | null;
}

@ObjectType()
export class FuelPlan {
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
  @Field() encodedPolyline: string;
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
