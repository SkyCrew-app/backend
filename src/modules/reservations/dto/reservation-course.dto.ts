import { Field, Int, ObjectType } from '@nestjs/graphql';

// The instruction course a booking was made for: its aircraft. Its
// instructor gives the course; a booking whose instructor changes leaves it.
@ObjectType()
export class ReservationCourse {
  @Field(() => Int)
  id: number;

  @Field()
  startTime: Date;

  @Field({ nullable: true })
  endTime?: Date;
}
