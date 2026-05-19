import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/entity/users.entity';
import { Reservation } from '../../reservations/entity/reservations.entity';
import { Incident } from '../../incidents/entity/incidents.entity';

@ObjectType()
@Entity('flights')
export class Flight {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Reservation, { nullable: true })
  @ManyToOne(() => Reservation, (reservation) => reservation.flights, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  reservation: Reservation;

  @Field(() => Incident, { nullable: true })
  @ManyToOne(() => Incident, (incident) => incident.flight, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  incident: Incident;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.flights, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  user: User;

  @Field(() => Float)
  @Column('float')
  flight_hours: number;

  @Field()
  @Column()
  flight_type: string;

  @Field()
  @Column()
  origin_icao: string;

  @Field()
  @Column()
  destination_icao: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  weather_conditions: string;

  @Field(() => Int, { nullable: true })
  @Column()
  number_of_passengers?: number;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  encoded_polyline: string;

  @Field(() => Float, { nullable: true })
  @Column('float', { nullable: true })
  distance_km: number;

  @Field(() => Float, { nullable: true })
  @Column('float', { nullable: true })
  estimated_flight_time: number;

  @Field(() => String, { nullable: true })
  @Column('jsonb', { nullable: true })
  waypoints: string;

  @Field(() => String, { nullable: true })
  departure_airport_info?: string;

  @Field(() => String, { nullable: true })
  arrival_airport_info?: string;

  @Field(() => [String], { nullable: true })
  detailed_waypoints?: string[];
}
