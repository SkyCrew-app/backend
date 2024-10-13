import { InputType, Field, Int, Float } from '@nestjs/graphql';

@InputType()
export class CreateFlightInput {
  @Field(() => Int)
  reservation_id: number;

  @Field(() => Int)
  user_id: number;

  @Field(() => Float)
  flight_hours: number;

  @Field()
  flight_type: string;

  @Field()
  origin_airport: string;

  @Field()
  destination_airport: string;

  @Field({ nullable: true })
  weather_conditions?: string;

  @Field(() => Int)
  number_of_passengers: number;

  @Field({ nullable: true })
  milestone_reached?: boolean;
}
