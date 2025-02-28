import { InputType, Field, Float } from '@nestjs/graphql';

@InputType()
export class CreateFinancialReportInput {
  @Field()
  report_date: Date;

  @Field(() => Float)
  total_revenue: number;

  @Field(() => Float)
  total_expense: number;

  @Field(() => Float)
  net_profit: number;

  @Field({ nullable: true })
  recommendations?: string;

  @Field(() => Float, { nullable: true })
  average_revenue_per_member?: number;
}
