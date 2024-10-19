import { InputType, Field, Int, Float } from '@nestjs/graphql';

@InputType()
export class CreateReservationInput {
  @Field(() => Int)
  aircraft_id: number;

  @Field(() => Int)
  user_id: number;

  @Field({ nullable: true })
  reservation_date: Date;

  @Field()
  start_time: Date;

  @Field()
  end_time: Date;

  @Field({ nullable: true })
  purpose?: string;

  @Field({ nullable: true })
  flight_category?: string;

  @Field(() => Float, { nullable: true })
  estimated_flight_hours?: number;

  @Field({ nullable: true })
  notes?: string;

  @Field({ nullable: true })
  status?: string;
}
