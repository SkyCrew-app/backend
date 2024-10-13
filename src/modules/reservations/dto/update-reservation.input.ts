import { InputType, Field, Int, Float } from '@nestjs/graphql';

@InputType()
export class UpdateReservationInput {
  @Field(() => Int)
  id: number;

  @Field(() => Int, { nullable: true })
  aircraft_id?: number;

  @Field(() => Int, { nullable: true })
  user_id?: number;

  @Field({ nullable: true })
  reservation_date?: Date;

  @Field({ nullable: true })
  start_time?: Date;

  @Field({ nullable: true })
  end_time?: Date;

  @Field({ nullable: true })
  purpose?: string;

  @Field({ nullable: true })
  flight_category?: string;

  @Field(() => Float, { nullable: true })
  estimated_flight_hours?: number;
}