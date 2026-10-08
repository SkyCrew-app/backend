import { InputType, Field, Int, Float } from '@nestjs/graphql';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { FlightCategory } from '../../reservations/entity/reservations.entity';

@InputType()
export class CreateFlightInput {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  reservation_id?: number;

  @Field(() => Int)
  @IsInt()
  user_id: number;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  flight_hours: number;

  @Field(() => FlightCategory)
  @IsNotEmpty()
  flight_type: FlightCategory;

  @Field()
  @IsString()
  @Length(4, 4, { message: 'Le code ICAO doit contenir exactement 4 caractères' })
  origin_icao: string;

  @Field()
  @IsString()
  @Length(4, 4, { message: 'Le code ICAO doit contenir exactement 4 caractères' })
  destination_icao: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  weather_conditions?: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  number_of_passengers: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
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
  @IsOptional()
  waypoints: string[];

  @Field({ nullable: true })
  @IsOptional()
  departure_time?: Date;

  @Field({ nullable: true })
  @IsOptional()
  arrival_time?: Date;
}
