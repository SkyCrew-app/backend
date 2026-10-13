import { InputType, Field, Int, Float } from '@nestjs/graphql';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

@InputType()
export class UpdateFlightInput {
  @Field(() => Int)
  id: number;

  @Field(() => Int, { nullable: true })
  reservation_id?: number;

  @Field(() => Int, { nullable: true })
  user_id?: number;

  // Its bounds are checked by the service, which answers in the member's
  // language.
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  flight_hours?: number;

  @Field({ nullable: true })
  flight_type?: string;

  @Field({ nullable: true })
  origin_icao?: string;

  @Field({ nullable: true })
  destination_icao?: string;

  @Field({ nullable: true })
  weather_conditions?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  // Closes the flight: what was flown is final for its pilot afterwards.
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  closed?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  number_of_passengers?: number;

  @Field({ nullable: true })
  encoded_polyline?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  distance_km?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimated_flight_time?: number;

  @Field(() => [String], { nullable: true })
  waypoints?: string[];

  @Field({ nullable: true })
  departure_time?: Date;

  @Field({ nullable: true })
  arrival_time?: Date;
}
