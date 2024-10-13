import { InputType, Field, Int, Float } from '@nestjs/graphql';

@InputType()
export class CreateExpenseInput {
  @Field(() => Int)
  aircraft_id: number;

  @Field(() => Float)
  amount: number;

  @Field()
  expense_type: string;

  @Field()
  expense_date: Date;

  @Field({ nullable: true })
  supplier?: string;

  @Field({ nullable: true })
  receipt_url?: string;

  @Field({ nullable: true })
  expense_category?: string;
}
