import { ObjectType, Field, Int } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { Reservation } from '../../reservations/entity/reservations.entity';
import { Maintenance } from '../../maintenance/entity/maintenance.entity';
import { License } from '../../licenses/entity/licenses.entity';
import { Invoice } from '../../invoices/entity/invoices.entity';
import { Role } from '../../roles/entity/roles.entity';
import { Flight } from '../../flights/entity/flights.entity';
import { Payment } from '../../payments/entity/payments.entity';
import { Answer } from '../../eval/entity/answer.entity';
import { UserProgress } from './user-progress.entity';

@ObjectType()
@Entity('users')
export class User {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column()
  first_name: string;

  @Field()
  @Column()
  last_name: string;

  @Field()
  @Column({ unique: true })
  email: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  password: string;

  @Field(() => Boolean)
  @Column({ default: false })
  is2FAEnabled: boolean;

  @Field(() => Boolean)
  @Column({ default: false })
  isEmailConfirmed: boolean;

  @Field({ nullable: true })
  @Column({ nullable: true })
  twoFactorAuthSecret: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  phone_number: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  address: string;

  @Field({ nullable: false })
  @Column()
  date_of_birth: Date;

  @Field({ nullable: true })
  @Column({ nullable: true })
  profile_picture: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  total_flight_hours: number;

  @Field({ nullable: false })
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  user_account_balance: number;

  @Field(() => Boolean)
  @Column({ default: true })
  email_notifications_enabled: boolean;

  @Field(() => Boolean)
  @Column({ default: false })
  sms_notifications_enabled: boolean;

  @Field(() => Boolean)
  @Column({ default: true })
  newsletter_subscribed: boolean;

  @Field({ nullable: true })
  @Column({ nullable: true })
  validation_token: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  language: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  speed_unit: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  distance_unit: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  timezone: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  preferred_aerodrome: string;

  @Field(() => Role, { nullable: true })
  @ManyToOne(() => Role, (role) => role.users, { nullable: true })
  role: Role;

  @Field(() => [Reservation])
  @OneToMany(() => Reservation, (reservation) => reservation.user)
  reservations: Reservation[];

  @Field(() => [Maintenance], { nullable: true })
  @OneToMany(() => Maintenance, (maintenance) => maintenance.technician)
  maintenances: Maintenance[];

  @Field(() => [License], { nullable: true })
  @OneToMany(() => License, (license) => license.user, { cascade: true })
  licenses?: License[];

  @Field(() => [Invoice])
  @OneToMany(() => Invoice, (invoice) => invoice.user)
  invoices: Invoice[];

  @Field(() => [Flight])
  @OneToMany(() => Flight, (flight) => flight.user)
  flights: any;

  @Field(() => [Payment])
  @OneToMany(() => Payment, (payment) => payment.user)
  payments: Payment[];

  @Field(() => [Answer])
  @OneToMany(() => Answer, (answer) => answer.user, { cascade: true })
  answers: Answer[];

  @OneToMany(() => UserProgress, (progress) => progress.user)
  @Field(() => [UserProgress])
  userProgresses: UserProgress[];
}
