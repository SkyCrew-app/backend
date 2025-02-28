import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@ObjectType()
@Entity('financial_reports')
export class FinancialReport {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Date)
  @Column({ type: 'timestamp' })
  report_date: Date;

  @Field(() => Float)
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  total_revenue: number;

  @Field(() => Float)
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  total_expense: number;

  @Field(() => Float)
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  net_profit: number;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  recommendations?: string;

  @Field(() => Float, { nullable: true })
  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  average_revenue_per_member?: number;
}
