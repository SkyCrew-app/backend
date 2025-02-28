import { InputType, Field, Int, Float } from '@nestjs/graphql';

@InputType()
export class UpdateExpenseInput {
  @Field(() => Int)
  id: number;

  @Field({ nullable: true })
  expense_date?: Date;

  @Field(() => Float, { nullable: true })
  amount?: number;

  @Field({ nullable: true })
  category?: string;

  @Field({ nullable: true })
  sub_category?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Int, { nullable: true })
  aircraft_id?: number;
}
