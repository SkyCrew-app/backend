import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class AircraftAuditStats {
  @Field(() => Int)
  aircraftId: number;

  @Field()
  registration: string;

  @Field(() => Int)
  auditCount: number;

  @Field(() => Int)
  nonConformCount: number;
}

@ObjectType()
export class MonthlyAuditStats {
  @Field(() => Int)
  month: number;

  @Field(() => Int)
  year: number;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class AuditStatistics {
  @Field(() => Int)
  totalAudits: number;

  @Field(() => Int)
  conformCount: number;

  @Field(() => Int)
  nonConformCount: number;

  @Field(() => Int)
  conformWithRemarksCount: number;

  @Field(() => Int)
  openAudits: number;

  @Field(() => Int)
  closedAudits: number;

  @Field(() => [AircraftAuditStats])
  auditsByAircraft: AircraftAuditStats[];

  @Field(() => [MonthlyAuditStats])
  auditsByMonth: MonthlyAuditStats[];
}
