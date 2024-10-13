import { InputType, Field, Int, Float } from '@nestjs/graphql';

@InputType()
export class UpdateExpenseInput {
  @Field(() => Int)
  id: number;

  @Field(() => Float, { nullable: true })
  amount?: number;

  @Field({ nullable: true })
  expense_type?: string;

  @Field({ nullable: true })
  expense_date?: Date;

  @Field({ nullable: true })
  supplier?: string;

  @Field({ nullable: true })
  receipt_url?: string;

  @Field({ nullable: true })
  expense_category?: string;
}
