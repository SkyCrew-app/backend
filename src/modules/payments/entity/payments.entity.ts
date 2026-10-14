import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../../users/entity/users.entity';
import { Invoice } from '../../invoices/entity/invoices.entity';

// What a line of the account history is. The sign of a line on the balance
// follows from its kind (see balanceSign).
export const PAYMENT_KIND = {
  TOP_UP: 'top_up',
  BOOKING: 'booking',
  BOOKING_REFUND: 'booking_refund',
  MANUAL_CREDIT: 'manual_credit',
  MANUAL_DEBIT: 'manual_debit',
  PROVIDER_REFUND: 'provider_refund',
  // A chargeback the club won: what the dispute had taken comes back.
  DISPUTE_WON: 'dispute_won',
} as const;

export type PaymentKind = (typeof PAYMENT_KIND)[keyof typeof PAYMENT_KIND];

const CREDIT_KINDS: string[] = [
  PAYMENT_KIND.TOP_UP,
  PAYMENT_KIND.BOOKING_REFUND,
  PAYMENT_KIND.MANUAL_CREDIT,
  PAYMENT_KIND.DISPUTE_WON,
];

// +1 when the line adds to the member's balance, -1 when it takes from it.
export const balanceSign = (kind: string): 1 | -1 =>
  CREDIT_KINDS.includes(kind) ? 1 : -1;

// Postgres returns numeric columns as text.
const asNumber = {
  to: (value: number | null | undefined) => value,
  from: (value: string | number | null) =>
    value === null || value === undefined ? null : Number(value),
};

@ObjectType()
@Entity('payments')
@Index('IDX_payments_user_date', ['user', 'payment_date'])
@Index('IDX_payments_date', ['payment_date'])
@Index('IDX_payments_reservation', ['reservation_id'])
@Index('IDX_payments_invoice', ['invoice'])
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

  @Field()
  @Column({ type: 'varchar', length: 30, default: PAYMENT_KIND.TOP_UP })
  kind: string;

  // Why the line exists: mandatory for an entry made by hand.
  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  reason: string;

  // The booking a charge or a refund belongs to. Not a foreign key: the line
  // outlives a cancelled booking.
  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  reservation_id: number;

  // What the provider has given back of a top-up so far.
  @Field(() => Float)
  @Column('decimal', {
    precision: 10,
    scale: 2,
    default: 0,
    transformer: asNumber,
  })
  refunded_amount: number;

  // The administrator who made an entry by hand. Never part of the API.
  @Column({ type: 'int', nullable: true })
  created_by_id: number;
}
