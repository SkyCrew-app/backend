import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';

@ObjectType()
@Entity('expenses')
export class Expense {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Aircraft)
  @ManyToOne(() => Aircraft, (aircraft) => aircraft.id)
  aircraft: Aircraft;

  @Field(() => Float)
  @Column('float')
  amount: number;

  @Field()
  @Column()
  expense_type: string;

  @Field()
  @Column()
  expense_date: Date;

  @Field({ nullable: true })
  @Column({ nullable: true })
  supplier: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  receipt_url: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  expense_category: string;
}
