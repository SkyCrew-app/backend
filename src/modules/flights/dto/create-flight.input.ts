import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { FlightCategory } from '../../reservations/entity/reservations.entity';

@InputType()
export class CreateFlightInput {
  @Field(() => Int, { nullable: true })
  reservation_id?: number;

  @Field(() => Int)
  user_id: number;

  @Field(() => Float)
  flight_hours: number;

  @Field(() => FlightCategory)
  flight_type: FlightCategory;

  @Field()
  origin_icao: string;

  @Field()
  destination_icao: string;

  @Field({ nullable: true })
  weather_conditions?: string;

  @Field(() => Int)
  number_of_passengers: number;

  @Field({ nullable: true })
  encoded_polyline?: string;

  @Field(() => Float, { nullable: true })
  distance_km?: number;

  @Field(() => Float, { nullable: true })
  estimated_flight_time?: number;

  @Field(() => [String], { nullable: true })
  waypoints: string[];
}
