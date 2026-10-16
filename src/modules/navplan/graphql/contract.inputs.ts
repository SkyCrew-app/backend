import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  EnvelopeCategoryEnum,
  FuelTypeEnum,
  ReserveCaseEnum,
  StationKindEnum,
} from './enums';

// Input types of the flight preparation contract (design § 3.2), with the
// bounds the API enforces. Rules needing more than one field (legs =
// waypoints + 1, envelope polygons...) are checked by the services.

const MAX_WAYPOINTS = 40;

@InputType()
export class LatLonInput {
  @Field(() => Float) @IsNumber() @Min(-90) @Max(90) lat: number;
  @Field(() => Float) @IsNumber() @Min(-180) @Max(180) lon: number;
}

@InputType()
export class BBoxInput {
  @Field(() => Float) @IsNumber() @Min(-90) @Max(90) south: number;
  @Field(() => Float) @IsNumber() @Min(-180) @Max(180) west: number;
  @Field(() => Float) @IsNumber() @Min(-90) @Max(90) north: number;
  @Field(() => Float) @IsNumber() @Min(-180) @Max(180) east: number;
}

@InputType()
export class FuelTankInput {
  @Field() @IsString() @MaxLength(32) id: string;
  @Field() @IsString() @MaxLength(64) label: string;
  @Field(() => Float) @IsNumber() @Min(0) @Max(2000) usableL: number;
  @Field(() => Float) @IsNumber() @Min(0) @Max(200) unusableL: number;
  @Field(() => Float) @IsNumber() @Min(-10) @Max(20) armM: number;
}

@InputType()
export class FuelDataInput {
  @Field(() => FuelTypeEnum) @IsEnum(FuelTypeEnum) type: FuelTypeEnum;
  @Field(() => Float) @IsNumber() @Min(0.5) @Max(1) densityKgPerL: number;
  @Field(() => [FuelTankInput])
  @ValidateNested({ each: true })
  @Type(() => FuelTankInput)
  @ArrayMaxSize(8)
  tanks: FuelTankInput[];
  @Field(() => Float) @IsNumber() @Min(0) @Max(100) taxiFuelL: number;
  @Field(() => [String])
  @IsString({ each: true })
  @ArrayMaxSize(8)
  burnOrder: string[];
}

@InputType()
export class ClimbRowInput {
  @Field(() => Int) @IsInt() @Min(-2000) @Max(30000) pressureAltFt: number;
  @Field(() => Float) @IsNumber() @Min(0) @Max(120) timeMin: number;
  @Field(() => Float) @IsNumber() @Min(0) @Max(200) fuelL: number;
  @Field(() => Float) @IsNumber() @Min(0) @Max(300) distanceNm: number;
}

@InputType()
export class ClimbDataInput {
  @Field(() => Int) @IsInt() @Min(30) @Max(250) iasKt: number;
  @Field(() => [ClimbRowInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ClimbRowInput)
  @ArrayMaxSize(60)
  table?: ClimbRowInput[] | null;
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(5000)
  seaLevelRateFpm?: number | null;
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  ceilingRateFpm?: number | null;
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  fuelFlowLph?: number | null;
}

@InputType()
export class CruiseRowInput {
  @Field(() => Int) @IsInt() @Min(-2000) @Max(30000) pressureAltFt: number;
  @Field() @IsString() @MaxLength(32) setting: string;
  @Field(() => Int) @IsInt() @Min(-60) @Max(60) isaDeviationC: number;
  @Field(() => Float) @IsNumber() @Min(30) @Max(300) tasKt: number;
  @Field(() => Float) @IsNumber() @Min(1) @Max(500) fuelFlowLph: number;
}

@InputType()
export class CruiseDataInput {
  @Field() @IsString() @MaxLength(32) normalSetting: string;
  @Field(() => [CruiseRowInput])
  @ValidateNested({ each: true })
  @Type(() => CruiseRowInput)
  @ArrayMaxSize(400)
  rows: CruiseRowInput[];
}

@InputType()
export class DescentDataInput {
  @Field(() => Int) @IsInt() @Min(30) @Max(250) iasKt: number;
  @Field(() => Int) @IsInt() @Min(100) @Max(3000) rateFpm: number;
  @Field(() => Float) @IsNumber() @Min(0) @Max(500) fuelFlowLph: number;
}

@InputType()
export class CalibrationRowInput {
  @Field(() => Float) @IsNumber() @Min(0) @Max(300) iasKt: number;
  @Field(() => Float) @IsNumber() @Min(0) @Max(300) casKt: number;
}

@InputType()
export class ReserveDataInput {
  @Field(() => Float) @IsNumber() @Min(1) @Max(500) holdingFuelFlowLph: number;
  @Field(() => Float)
  @IsNumber()
  @Min(1)
  @Max(500)
  maxContinuousFuelFlowLph: number;
}

@InputType()
export class AircraftPerformanceInput {
  @Field(() => FuelDataInput)
  @ValidateNested()
  @Type(() => FuelDataInput)
  fuel: FuelDataInput;
  @Field(() => ClimbDataInput)
  @ValidateNested()
  @Type(() => ClimbDataInput)
  climb: ClimbDataInput;
  @Field(() => CruiseDataInput)
  @ValidateNested()
  @Type(() => CruiseDataInput)
  cruise: CruiseDataInput;
  @Field(() => DescentDataInput)
  @ValidateNested()
  @Type(() => DescentDataInput)
  descent: DescentDataInput;
  @Field(() => ReserveDataInput)
  @ValidateNested()
  @Type(() => ReserveDataInput)
  reserve: ReserveDataInput;
  @Field(() => Float) @IsNumber() @Min(0) @Max(100) arrivalFuelL: number;
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(30000)
  serviceCeilingFt?: number | null;
  @Field(() => [CalibrationRowInput])
  @ValidateNested({ each: true })
  @Type(() => CalibrationRowInput)
  @ArrayMaxSize(60)
  calibration: CalibrationRowInput[];
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  // Template sources cite several documents with page numbers.
  @MaxLength(2000)
  source?: string | null;
}

@InputType()
export class StationInput {
  @Field() @IsString() @MaxLength(32) id: string;
  @Field() @IsString() @MaxLength(64) label: string;
  @Field(() => StationKindEnum) @IsEnum(StationKindEnum) kind: StationKindEnum;
  @Field(() => Float) @IsNumber() @Min(-10) @Max(20) armM: number;
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5000)
  maxKg?: number | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() tankId?:
    | string
    | null;
}

@InputType()
export class CombinedLimitInput {
  @Field(() => [String]) @IsString({ each: true }) stationIds: string[];
  @Field(() => Float) @IsNumber() @Min(0) @Max(5000) maxKg: number;
  @Field() @IsString() @MaxLength(64) label: string;
}

@InputType()
export class EnvelopePointInput {
  @Field(() => Float) @IsNumber() @Min(-10) @Max(20) armM: number;
  @Field(() => Float) @IsNumber() @Min(0) @Max(10000) massKg: number;
}

@InputType()
export class EnvelopeInput {
  @Field(() => EnvelopeCategoryEnum)
  @IsEnum(EnvelopeCategoryEnum)
  category: EnvelopeCategoryEnum;
  @Field(() => [EnvelopePointInput])
  @ValidateNested({ each: true })
  @Type(() => EnvelopePointInput)
  @ArrayMaxSize(50)
  points: EnvelopePointInput[];
}

@InputType()
export class AircraftMassBalanceInput {
  @Field(() => Float) @IsNumber() @Min(50) @Max(10000) emptyMassKg: number;
  @Field(() => Float) @IsNumber() @Min(-10) @Max(20) emptyArmM: number;
  @Field() @Type(() => Date) @IsDate() weighingDate: Date;
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  weighingRef?: string | null;
  @Field(() => Float) @IsNumber() @Min(50) @Max(10000) mtowKg: number;
  @Field(() => Float) @IsNumber() @Min(50) @Max(10000) mlwKg: number;
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(10000)
  mzfwKg?: number | null;
  @Field(() => [StationInput])
  @ValidateNested({ each: true })
  @Type(() => StationInput)
  @ArrayMaxSize(20)
  stations: StationInput[];
  @Field(() => [CombinedLimitInput])
  @ValidateNested({ each: true })
  @Type(() => CombinedLimitInput)
  @ArrayMaxSize(10)
  combinedLimits: CombinedLimitInput[];
  @Field(() => [EnvelopeInput])
  @ValidateNested({ each: true })
  @Type(() => EnvelopeInput)
  @ArrayMaxSize(3)
  envelopes: EnvelopeInput[];
}

@InputType()
export class FlightPlanningSettingsInput {
  @Field(() => Int) @IsInt() @Min(0) @Max(240) reserveVfrDayLocalMin: number;
  @Field(() => Int) @IsInt() @Min(0) @Max(240) reserveVfrDayMin: number;
  @Field(() => Int) @IsInt() @Min(0) @Max(240) reserveVfrNightMin: number;
  @Field(() => Float) @IsNumber() @Min(0) @Max(100) contingencyPercent: number;
  @Field(() => Float) @IsNumber() @Min(0) @Max(100) contingencyMinL: number;
  @Field() @IsBoolean() alternateRequiredVfr: boolean;
  @Field(() => Int) @IsInt() @Min(0) @Max(240) clubMarginMin: number;
  @Field(() => Int) @IsInt() @Min(0) @Max(2000) verticalMarginFt: number;
  @Field(() => Int)
  @IsInt()
  @Min(300)
  @Max(3000)
  defaultCircuitHeightFt: number;
}

@InputType()
export class RoutePointInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  navPointId?: string | null;
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number | null;
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon?: number | null;
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  name?: string | null;
}

@InputType()
export class WindInput {
  @Field(() => Int) @IsInt() @Min(0) @Max(360) directionDeg: number;
  @Field(() => Int) @IsInt() @Min(0) @Max(200) speedKt: number;
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(-80)
  @Max(60)
  temperatureC?: number | null;
}

@InputType()
export class LegInput {
  @Field(() => Int) @IsInt() @Min(0) @Max(25000) altitudeFt: number;
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  cruiseSetting?: string | null;
  @Field(() => WindInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => WindInput)
  windOverride?: WindInput | null;
}

@InputType()
export class LoadInput {
  @Field() @IsString() @MaxLength(32) stationId: string;
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2000)
  massKg?: number | null;
}

@InputType()
export class FuelLoadInput {
  @Field() @IsString() @MaxLength(32) tankId: string;
  @Field(() => Float) @IsNumber() @Min(0) @Max(2000) liters: number;
}

@InputType()
export class FlightPlanInput {
  @Field(() => Int) @IsInt() aircraftId: number;
  @Field(() => Int, { nullable: true }) @IsOptional() @IsInt() reservationId?:
    | number
    | null;
  @Field() @Type(() => Date) @IsDate() departureTime: Date;
  @Field(() => RoutePointInput)
  @ValidateNested()
  @Type(() => RoutePointInput)
  departure: RoutePointInput;
  @Field(() => RoutePointInput)
  @ValidateNested()
  @Type(() => RoutePointInput)
  destination: RoutePointInput;
  @Field(() => RoutePointInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => RoutePointInput)
  alternate?: RoutePointInput | null;
  @Field(() => [RoutePointInput])
  @ValidateNested({ each: true })
  @Type(() => RoutePointInput)
  @ArrayMaxSize(MAX_WAYPOINTS)
  waypoints: RoutePointInput[];
  @Field(() => [LegInput])
  @ValidateNested({ each: true })
  @Type(() => LegInput)
  @ArrayMaxSize(MAX_WAYPOINTS + 1)
  legs: LegInput[];
  @Field(() => ReserveCaseEnum)
  @IsEnum(ReserveCaseEnum)
  reserveCase: ReserveCaseEnum;
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(900)
  @Max(1080)
  qnhHpa?: number | null;
  @Field(() => [LoadInput])
  @ValidateNested({ each: true })
  @Type(() => LoadInput)
  @ArrayMaxSize(20)
  loads: LoadInput[];
  @Field(() => [FuelLoadInput])
  @ValidateNested({ each: true })
  @Type(() => FuelLoadInput)
  @ArrayMaxSize(8)
  fuel: FuelLoadInput[];
  @Field(() => EnvelopeCategoryEnum, {
    defaultValue: EnvelopeCategoryEnum.NORMAL,
  })
  @IsIn(Object.values(EnvelopeCategoryEnum))
  envelopeCategory: EnvelopeCategoryEnum;
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  extraFuelNote?: string | null;
}
