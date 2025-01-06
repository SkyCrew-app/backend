import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/entity/users.entity';
import { Invoice } from '../../invoices/entity/invoices.entity';

@ObjectType()
@Entity('payments')
export class Payment {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.payments)
  user: User;

  @Field(() => Invoice, { nullable: true })
  @ManyToOne(() => Invoice, (invoice) => invoice.payments, { nullable: true })
  invoice?: Invoice;

  @Field(() => Float)
  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Field()
  @Column()
  payment_date: Date;

  @Field()
  @Column({ type: 'varchar', length: 50 })
  payment_method: string;

  @Field()
  @Column({ type: 'varchar', length: 50 })
  payment_status: string;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  external_payment_id: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  payment_details: string;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  error_message: string;
}
