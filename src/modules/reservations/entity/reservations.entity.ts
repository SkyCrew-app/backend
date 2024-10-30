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
  OneToOne,
} from 'typeorm';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { User } from '../../users/entity/users.entity';
import { Flight } from '../../flights/entity/flights.entity';

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

@ObjectType()
@Entity('reservations')
export class Reservation {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Aircraft)
  @ManyToOne(() => Aircraft, (aircraft) => aircraft.reservations, {
    eager: false,
  })
  aircraft: Aircraft;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.reservations, { eager: false })
  user: User;

  @Field(() => Flight)
  @OneToOne(() => Flight, (flight) => flight.reservation)
  flight: Flight;

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
}
