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

registerEnumType(ReservationStatus, {
  name: 'ReservationStatus',
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

  @Field({ nullable: true })
  @Column({ nullable: true })
  notes: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  flight_category: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  calendar_integration_url: string;
}
