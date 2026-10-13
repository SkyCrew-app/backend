import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { FlightCategory } from '../entity/reservations.entity';

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

  @Field(() => FlightCategory)
  flight_category: FlightCategory;

  @Field(() => Float, { nullable: true })
  estimated_flight_hours?: number;

  @Field({ nullable: true })
  notes?: string;

  // Left out: the instructor stays. Null: the flight is made without one.
  @Field(() => Int, { nullable: true })
  instructor_id?: number | null;
}
