import {
  ObjectType,
  Field,
  Int,
  Float,
  registerEnumType,
} from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { User } from '../../users/entity/users.entity';
import { Flight } from '../../flights/entity/flights.entity';
// ChecklistSubmission imported via string-based relation to avoid circular dependency

export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

export enum FlightCategory {
  LOCAL = 'local',
  CROSS_COUNTRY = 'cross_country',
  INSTRUCTION = 'instruction',
  TOURISM = 'tourism',
  TRAINING = 'training',
  MAINTENANCE = 'maintenance',
  PRIVATE = 'private',
  CORPORATE = 'corporate',
}

registerEnumType(ReservationStatus, {
  name: 'ReservationStatus',
});

registerEnumType(FlightCategory, {
  name: 'FlightCategory',
});

// Names of the database guards added by the ReservationsNoDoubleBooking
// migration. They are deliberately not declared with @Check / @Exclusion:
// schema synchronisation (development) would then need the btree_gist
// extension and fail on a database that holds overlapping rows.
export const RESERVATION_SLOT_EXCLUSION = 'EXC_reservations_aircraft_slot';
export const RESERVATION_TIME_ORDER_CHECK = 'CHK_reservations_time_order';

@ObjectType()
@Entity('reservations')
@Index('IDX_reservations_user_start', ['user', 'start_time'])
@Index('IDX_reservations_instructor_start', ['instructor', 'start_time'])
@Index('IDX_reservations_start_time', ['start_time'])
@Index('IDX_reservations_end_time', ['end_time'])
export class Reservation {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Aircraft)
  @ManyToOne(() => Aircraft, (aircraft) => aircraft.reservations, {
    eager: true,
  })
  aircraft: Aircraft;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.reservations, { eager: true })
  user: User;

  // The instructor on board, for an instruction flight. Their agenda is
  // blocked like the pilot's and their licence is the one that must be valid.
  @Field(() => User, { nullable: true })
  @ManyToOne(() => User, { nullable: true, eager: true })
  instructor: User | null;

  @Field(() => [Flight], { nullable: true })
  @OneToMany(() => Flight, (flight) => flight.reservation, {
    nullable: true,
  })
  flights: Flight[];

  @Field({ nullable: true })
  @Column({ nullable: true })
  reservation_date: Date;

  @Field()
  @Column()
  start_time: Date;

  @Field()
  @Column()
  end_time: Date;

  @Field(() => Float, { nullable: true })
  @Column('float', { nullable: true })
  estimated_flight_hours: number;

  @Field({ nullable: true })
  @Column({ nullable: true })
  purpose: string;

  @Field(() => ReservationStatus)
  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.CONFIRMED,
  })
  status: ReservationStatus;

  @Field(() => FlightCategory)
  @Column({
    type: 'enum',
    enum: FlightCategory,
    default: FlightCategory.LOCAL,
  })
  flight_category: FlightCategory;

  @Field({ nullable: true })
  @Column({ nullable: true })
  notes: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  calendar_integration_url: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  number_of_passengers: number;

  // Use string-based relation to avoid circular import with ChecklistSubmission
  @OneToMany('ChecklistSubmission', 'reservation', { nullable: true })
  checklistSubmissions: any[];

  // What the member was charged for this booking, set when it is charged.
  // Refunds give back exactly this, whatever the rate has become since.
  // Null on bookings older than the column whose charge was not found.
  @Field(() => Float, { nullable: true })
  @Column('decimal', {
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null | undefined) => value,
      from: (value: string | number | null) =>
        value === null || value === undefined ? null : Number(value),
    },
  })
  charged_amount: number | null;
}
