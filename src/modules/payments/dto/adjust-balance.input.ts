import { InputType, Field, Float, Int } from '@nestjs/graphql';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

// A credit or a debit of a member's account entered by an administrator.
@InputType()
export class AdjustBalanceInput {
  @Field(() => Int)
  @IsInt()
  user_id: number;

  // Always positive: `credit` gives the direction.
  @Field(() => Float)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @Field()
  @IsBoolean()
  credit: boolean;

  // cash, cheque, transfer or correction.
  @Field()
  @IsString()
  payment_method: string;

  @Field()
  @IsString()
  @MaxLength(500)
  reason: string;
}
