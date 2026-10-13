import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { IsNumber, IsPositive } from 'class-validator';

@InputType()
export class CreateExpenseInput {
  @Field()
  expense_date: Date;

  @Field(() => Float)
  @IsNumber()
  @IsPositive()
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
