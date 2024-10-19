import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import { User } from '../../users/entity/users.entity';
import { Reservation } from '../../reservations/entity/reservations.entity';

@ObjectType()
@Entity('flights')
export class Flight {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Reservation)
  @ManyToOne(() => Reservation, (reservation) => reservation.id)
  reservation: Reservation;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.id)
  user: User;

  @Field(() => Float)
  @Column('float')
  flight_hours: number;

  @Field()
  @Column()
  flight_type: string;

  @Field()
  @Column()
  origin_airport: string;

  @Field()
  @Column()
  destination_airport: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  weather_conditions: string;

  @Field(() => Int)
  @Column()
  number_of_passengers: number;

  @Field(() => Boolean)
  @Column({ default: false })
  milestone_reached: boolean;

  @Field(() => Reservation)
  @OneToOne(() => Reservation, (reservation) => reservation.id)
  reservation_id: Reservation;
}
