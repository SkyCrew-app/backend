import { InputType, Field, Int, Float } from '@nestjs/graphql';

@InputType()
export class UpdateFlightInput {
  @Field(() => Int)
  id: number;

  @Field(() => Int, { nullable: true })
  reservation_id?: number;

  @Field(() => Int, { nullable: true })
  user_id?: number;

  @Field(() => Float, { nullable: true })
  flight_hours?: number;

  @Field({ nullable: true })
  flight_type?: string;

  @Field({ nullable: true })
  origin_icao?: string;

  @Field({ nullable: true })
  destination_icao?: string;

  @Field({ nullable: true })
  weather_conditions?: string;

  @Field(() => Int, { nullable: true })
  number_of_passengers?: number;

  @Field({ nullable: true })
  encoded_polyline?: string;

  @Field(() => Float, { nullable: true })
  distance_km?: number;

  @Field(() => Float, { nullable: true })
  estimated_flight_time?: number;

  @Field(() => [String], { nullable: true })
  waypoints?: string[];

  @Field({ nullable: true })
  departure_time?: Date;

  @Field({ nullable: true })
  arrival_time?: Date;
}
