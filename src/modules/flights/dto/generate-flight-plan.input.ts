import { InputType, Field, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, Length, Min, Max, IsIn } from 'class-validator';

@InputType()
export class GenerateFlightPlanInput {
  @Field()
  @IsString()
  @Length(4, 4, { message: 'Le code ICAO doit contenir exactement 4 caractères' })
  origin_icao: string;

  @Field()
  @IsString()
  @Length(4, 4, { message: 'Le code ICAO doit contenir exactement 4 caractères' })
  destination_icao: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  reservation_id?: number;

  @Field({ nullable: true, description: 'Preferred departure runway (e.g. "09L")' })
  @IsOptional()
  @IsString()
  preferred_runway_dep?: string;

  @Field({ nullable: true, description: 'Preferred arrival runway (e.g. "27R")' })
  @IsOptional()
  @IsString()
  preferred_runway_arr?: string;

  @Field(() => Int, { nullable: true, description: 'Cruise altitude override in feet' })
  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(45000)
  cruise_altitude_ft?: number;

  @Field({ nullable: true, description: 'Specific departure time (defaults to reservation start_time)' })
  @IsOptional()
  departure_time?: Date;

  @Field({ nullable: true, description: 'Flight rules override: VFR or IFR' })
  @IsOptional()
  @IsIn(['VFR', 'IFR'], { message: 'Les règles de vol doivent être VFR ou IFR' })
  flight_rules?: string;
}
