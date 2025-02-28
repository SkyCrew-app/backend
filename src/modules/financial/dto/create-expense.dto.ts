import { InputType, Field, Int, Float } from '@nestjs/graphql';

@InputType()
export class CreateExpenseInput {
  @Field()
  expense_date: Date;

  @Field(() => Float)
  amount: number;

  @Field()
  category: string;

  @Field({ nullable: true })
  sub_category?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Int, { nullable: true })
  aircraft_id?: number;
}
