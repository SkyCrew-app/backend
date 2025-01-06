import { InputType, Field, Float, Int } from '@nestjs/graphql';
import { IsDate, IsNumber, IsString, IsOptional } from 'class-validator';

@InputType()
export class CreateInvoiceInput {
  @Field(() => Int)
  user_id: number;

  @Field(() => Float)
  @IsNumber()
  amount: number;

  @Field()
  @IsDate()
  invoice_date: Date;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  payment_method?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  invoice_items?: string;

  @Field(() => Float)
  @IsNumber()
  balance_due: number;

  @Field({ nullable: true })
  @IsDate()
  @IsOptional()
  next_payment_due_date?: Date;
}
