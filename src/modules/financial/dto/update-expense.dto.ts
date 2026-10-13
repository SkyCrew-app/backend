import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { IsNumber, IsOptional, IsPositive } from 'class-validator';

@InputType()
export class UpdateExpenseInput {
  @Field(() => Int)
  id: number;

  @Field({ nullable: true })
  expense_date?: Date;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @IsPositive()
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
