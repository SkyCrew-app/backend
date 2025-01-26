import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entity/users.entity';
import { Payment } from '../../payments/entity/payments.entity';

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
  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Field()
  @Column()
  invoice_date: Date;

  @Field()
  @Column({ type: 'varchar', length: 50 })
  payment_status: string;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  payment_method: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  invoice_items: string;

  @Field(() => Float)
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  amount_paid: number;

  @Field(() => Float)
  @Column('decimal', { precision: 10, scale: 2 })
  balance_due: number;

  @Field({ nullable: true })
  @Column({ nullable: true })
  next_payment_due_date: Date;

  @Field(() => [Payment])
  @OneToMany(() => Payment, (payment) => payment.invoice)
  payments: Payment[];
}
