import { InputType, Field, Float, Int } from '@nestjs/graphql';
import { IsNumber, IsString } from 'class-validator';

@InputType()
export class CreatePaymentInput {
  @Field(() => Int)
  user_id: number;

  @Field(() => Float)
  @IsNumber()
  amount: number;

  @Field()
  @IsString()
  payment_method: string;
}
