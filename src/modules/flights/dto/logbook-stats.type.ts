import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class HoursEntry {
  @Field()
  label: string;

  @Field(() => Float)
  hours: number;
}

@ObjectType()
export class MonthlyHoursEntry {
  @Field()
  month: string;

  @Field(() => Float)
  hours: number;
}

@ObjectType()
export class LogbookStats {
  @Field(() => Float)
  totalHours: number;

  @Field(() => Int)
  totalFlights: number;

  @Field(() => [HoursEntry])
  hoursByModel: HoursEntry[];

  @Field(() => [HoursEntry])
  hoursByCategory: HoursEntry[];

  @Field(() => [MonthlyHoursEntry])
  monthlyHours: MonthlyHoursEntry[];

  @Field(() => Float)
  averageFlightDuration: number;

  @Field(() => Float)
  longestFlight: number;

  @Field(() => Float)
  last30DaysHours: number;

  @Field(() => Float)
  last90DaysHours: number;
}
