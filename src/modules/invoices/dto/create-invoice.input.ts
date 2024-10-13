import { InputType, Field, Int, Float } from '@nestjs/graphql';

@InputType()
export class CreateInvoiceInput {
  @Field(() => Int)
  user_id: number;

  @Field(() => Float)
  amount: number;

  @Field()
  invoice_date: Date;

  @Field({ nullable: true })
  payment_status?: string;

  @Field({ nullable: true })
  payment_method?: string;

  @Field({ nullable: true })
  invoice_items?: string;

  @Field(() => Float, { nullable: true })
  amount_paid?: number;

  @Field(() => Float)
  balance_due: number;

  @Field({ nullable: true })
  next_payment_due_date?: Date;
}
