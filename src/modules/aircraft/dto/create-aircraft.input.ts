import { InputType, Field, Int, Float } from '@nestjs/graphql';

@InputType()
export class CreateAircraftInput {
  @Field()
  registration_number: string;

  @Field()
  model: string;

  @Field(() => Int)
  year_of_manufacture: number;

  @Field()
  availability_status: string;

  @Field()
  maintenance_status: string;

  @Field(() => Float)
  hourly_cost: number;

  @Field({ nullable: true })
  insurance_document_url?: string;

  @Field({ nullable: true })
  last_inspection_date?: Date;

  @Field({ nullable: true })
  current_location?: string;
}
