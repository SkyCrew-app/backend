import { InputType, Field, Int, Float } from '@nestjs/graphql';

@InputType()
export class UpdateFinancialReportInput {
  @Field(() => Int)
  id: number;

  @Field({ nullable: true })
  report_date?: Date;

  @Field(() => Float, { nullable: true })
  total_revenue?: number;

  @Field(() => Float, { nullable: true })
  total_expense?: number;

  @Field(() => Float, { nullable: true })
  net_profit?: number;

  @Field({ nullable: true })
  recommendations?: string;

  @Field(() => Float, { nullable: true })
  average_revenue_per_member?: number;
}
