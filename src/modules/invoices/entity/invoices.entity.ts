import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/entity/users.entity';

@ObjectType()
@Entity('invoices')
export class Invoice {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.invoices)
  user: User;

  @Field(() => Float)
  @Column('float')
  amount: number;

  @Field()
  @Column()
  invoice_date: Date;

  @Field()
  @Column({ default: 'unpaid' })
  payment_status: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  payment_method: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  invoice_items: string;

  @Field(() => Float, { nullable: true })
  @Column('float', { nullable: true, default: 0 })
  amount_paid: number;

  @Field(() => Float)
  @Column('float')
  balance_due: number;

  @Field({ nullable: true })
  @Column({ nullable: true })
  next_payment_due_date: Date;
}
