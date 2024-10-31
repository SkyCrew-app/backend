import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { AvailabilityStatus } from '../entity/aircraft.entity';

@InputType()
export class UpdateAircraftInput {
  @Field(() => Int)
  id: number;

  @Field({ nullable: true })
  registration_number?: string;

  @Field({ nullable: true })
  model?: string;

  @Field(() => Int, { nullable: true })
  year_of_manufacture?: number;

  @Field(() => AvailabilityStatus, { nullable: true })
  availability_status?: AvailabilityStatus;

  @Field({ nullable: true })
  maintenance_status?: string;

  @Field(() => Float, { nullable: true })
  hourly_cost?: number;

  @Field({ nullable: true })
  image_url?: string;

  @Field(() => [String], { nullable: true })
  documents_url: string[];

  @Field({ nullable: true })
  last_inspection_date?: Date;

  @Field({ nullable: true })
  current_location?: string;
}
