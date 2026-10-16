import { registerEnumType } from '@nestjs/graphql';

// Enums of the flight preparation contract (design § 3.2). The values are
// the strings the engine uses.

export enum NavPointTypeEnum {
  AERODROME = 'AERODROME',
  VOR = 'VOR',
  VOR_DME = 'VOR_DME',
  NDB = 'NDB',
  DME = 'DME',
  TACAN = 'TACAN',
  VRP = 'VRP',
  USER = 'USER',
}
export enum AirspaceTypeEnum {
  P = 'P',
  R = 'R',
  D = 'D',
  CTR = 'CTR',
  TMA = 'TMA',
  CTA = 'CTA',
  SIV = 'SIV',
  RMZ = 'RMZ',
  TMZ = 'TMZ',
  TRA = 'TRA',
  TSA = 'TSA',
  PROTECTED = 'PROTECTED',
  GLIDING = 'GLIDING',
  OTHER = 'OTHER',
}
export enum AltitudeRefEnum {
  SFC = 'SFC',
  AGL = 'AGL',
  AMSL = 'AMSL',
  FL = 'FL',
}
export enum FuelTypeEnum {
  AVGAS_100LL = 'AVGAS_100LL',
  UL91 = 'UL91',
  JET_A1 = 'JET_A1',
  MOGAS = 'MOGAS',
}
export enum StationKindEnum {
  SEAT = 'SEAT',
  BAGGAGE = 'BAGGAGE',
  FUEL = 'FUEL',
  OTHER = 'OTHER',
}
export enum EnvelopeCategoryEnum {
  NORMAL = 'NORMAL',
  UTILITY = 'UTILITY',
  AEROBATIC = 'AEROBATIC',
}
export enum FlightPhaseEnum {
  CLIMB = 'CLIMB',
  CRUISE = 'CRUISE',
  DESCENT = 'DESCENT',
}
export enum CheckStatusEnum {
  OK = 'OK',
  WARNING = 'WARNING',
  BLOCKING = 'BLOCKING',
}
export enum AirspaceRelationEnum {
  INSIDE = 'INSIDE',
  NEAR_FLOOR = 'NEAR_FLOOR',
  NEAR_CEILING = 'NEAR_CEILING',
  UNKNOWN_VERTICAL = 'UNKNOWN_VERTICAL',
  BELOW = 'BELOW',
  ABOVE = 'ABOVE',
}
export enum ReserveCaseEnum {
  VFR_DAY_LOCAL = 'VFR_DAY_LOCAL',
  VFR_DAY = 'VFR_DAY',
  VFR_NIGHT = 'VFR_NIGHT',
}
export enum DataSourceKindEnum {
  METAR = 'METAR',
  TAF = 'TAF',
  MODEL = 'MODEL',
  PILOT = 'PILOT',
  NONE = 'NONE',
}
export enum PdfFormatEnum {
  A4 = 'A4',
  A5 = 'A5',
}

registerEnumType(NavPointTypeEnum, { name: 'NavPointType' });
registerEnumType(AirspaceTypeEnum, { name: 'AirspaceType' });
registerEnumType(AltitudeRefEnum, { name: 'AltitudeRef' });
registerEnumType(FuelTypeEnum, { name: 'FuelType' });
registerEnumType(StationKindEnum, { name: 'StationKind' });
registerEnumType(EnvelopeCategoryEnum, { name: 'EnvelopeCategory' });
registerEnumType(FlightPhaseEnum, { name: 'FlightPhase' });
registerEnumType(CheckStatusEnum, { name: 'CheckStatus' });
registerEnumType(AirspaceRelationEnum, { name: 'AirspaceRelation' });
registerEnumType(ReserveCaseEnum, { name: 'ReserveCase' });
registerEnumType(DataSourceKindEnum, { name: 'DataSourceKind' });
registerEnumType(PdfFormatEnum, { name: 'PdfFormat' });
