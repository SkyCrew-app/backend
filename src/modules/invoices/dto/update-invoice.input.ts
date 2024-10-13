import { InputType, Field, Int, Float } from '@nestjs/graphql';

@InputType()
export class UpdateInvoiceInput {
  @Field(() => Int)
  id: number;

  @Field(() => Float, { nullable: true })
  amount?: number;

  @Field({ nullable: true })
  invoice_date?: Date;

  @Field({ nullable: true })
  payment_status?: string;

  @Field({ nullable: true })
  payment_method?: string;

  @Field({ nullable: true })
  invoice_items?: string;

  @Field(() => Float, { nullable: true })
  amount_paid?: number;

  @Field(() => Float, { nullable: true })
  balance_due?: number;

  @Field({ nullable: true })
  next_payment_due_date?: Date;
}
