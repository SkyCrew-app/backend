import { ObjectType, Field, Int, FieldMiddleware } from '@nestjs/graphql';
import {
  Entity,
  Column,
  Index,
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
import { DashboardWidgetConfig } from '../dto/dashboard-widget-config.type';
import { privateField, profileField } from '../user-visibility';

// Credentials stay in the schema for older clients but are never returned.
const neverExposed: FieldMiddleware = async () => null;

// Only the fields without a visibility rule are readable by every member:
// see user-visibility.ts before adding one.
@ObjectType()
@Entity('users')
// One account per address whatever its case. Created by a migration, which
// skips it when existing rows already collide.
@Index('UQ_users_email_lower', { synchronize: false })
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

  @Field({
    nullable: true,
    deprecationReason: 'Never returned.',
    middleware: [neverExposed],
  })
  @Column({ nullable: true })
  password: string;

  @Field(() => Boolean, { nullable: true, middleware: [privateField] })
  @Column({ default: false })
  is2FAEnabled: boolean;

  @Field(() => Boolean, { nullable: true, middleware: [privateField] })
  @Column({ default: false })
  isEmailConfirmed: boolean;

  // A deactivated member cannot sign in and their sessions are refused;
  // everything they did is kept.
  @Field(() => Boolean, { nullable: true, middleware: [privateField] })
  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  twoFactorAuthSecret: string;

  // Secret shown to the user but not yet confirmed with a first code.
  @Column({ nullable: true })
  twoFactorAuthPendingSecret: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  phone_number: string;

  @Field({ nullable: true, middleware: [profileField] })
  @Column({ nullable: true })
  address: string;

  @Field({ nullable: true, middleware: [profileField] })
  @Column()
  date_of_birth: Date;

  @Field({ nullable: true })
  @Column({ nullable: true })
  profile_picture: string;

  @Field({ nullable: true, middleware: [profileField] })
  @Column('float', { default: 0 })
  total_flight_hours: number;

  @Field({ nullable: true, middleware: [privateField] })
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  user_account_balance: number;

  @Field(() => Boolean, { nullable: true, middleware: [privateField] })
  @Column({ default: true })
  email_notifications_enabled: boolean;

  @Field(() => Boolean, { nullable: true, middleware: [privateField] })
  @Column({ default: false })
  sms_notifications_enabled: boolean;

  @Field(() => Boolean, { nullable: true, middleware: [privateField] })
  @Column({ default: true })
  newsletter_subscribed: boolean;

  @Field({
    nullable: true,
    deprecationReason: 'Never returned.',
    middleware: [neverExposed],
  })
  @Column({ nullable: true })
  validation_token: string;

  // The invitation link stops working after this date. Never part of the API.
  @Column({ type: 'timestamptz', nullable: true })
  validationTokenExpiresAt: Date;

  // Password reset: never part of the API. Only the hash of the token sent
  // by e-mail is kept, with its expiry.
  @Column({ nullable: true })
  passwordResetTokenHash: string;

  @Column({ type: 'timestamptz', nullable: true })
  passwordResetExpiresAt: Date;

  // Raised when the password changes: sessions opened before are refused.
  // Never part of the API.
  @Column({ type: 'int', default: 0 })
  sessionVersion: number;

  // When the member last opened a session (password, then the code of their
  // authenticator when they use one). Kept after the connection log is
  // purged. Set by the connection log only.
  @Field({ nullable: true, middleware: [privateField] })
  @Column({ name: 'last_sign_in_at', type: 'timestamptz', nullable: true })
  lastSignInAt: Date;

  // Language the member is written to (e-mails, notifications): 'fr' or 'en'.
  @Field({ nullable: true, middleware: [privateField] })
  @Column({ type: 'varchar', default: 'fr' })
  language: string;

  @Field({ nullable: true, middleware: [privateField] })
  @Column({ nullable: true })
  speed_unit: string;

  @Field({ nullable: true, middleware: [privateField] })
  @Column({ nullable: true })
  distance_unit: string;

  @Field({ nullable: true, middleware: [privateField] })
  @Column({ nullable: true })
  timezone: string;

  @Field({ nullable: true, middleware: [privateField] })
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

  @Field(() => [License], { nullable: true, middleware: [profileField] })
  @OneToMany(() => License, (license) => license.user, { cascade: true })
  licenses?: License[];

  @Field(() => [Invoice], { nullable: true, middleware: [privateField] })
  @OneToMany(() => Invoice, (invoice) => invoice.user)
  invoices: Invoice[];

  // Flights, answers and progress have their own queries, which apply the
  // instructor-of-this-student rule: through the member they stay private.
  @Field(() => [Flight], { nullable: true, middleware: [privateField] })
  @OneToMany(() => Flight, (flight) => flight.user)
  flights: any;

  @Field(() => [Payment], { nullable: true, middleware: [privateField] })
  @OneToMany(() => Payment, (payment) => payment.user)
  payments: Payment[];

  @Field(() => [Answer], { nullable: true, middleware: [privateField] })
  @OneToMany(() => Answer, (answer) => answer.user, { cascade: true })
  answers: Answer[];

  @OneToMany(() => UserProgress, (progress) => progress.user)
  @Field(() => [UserProgress], { nullable: true, middleware: [privateField] })
  userProgresses: UserProgress[];

  @Field(() => [DashboardWidgetConfig], {
    nullable: true,
    middleware: [privateField],
  })
  @Column('jsonb', { nullable: true, default: null })
  dashboard_widgets: DashboardWidgetConfig[] | null;
}
