import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { User } from '../../users/entity/users.entity';

@ObjectType()
@Entity('reservations')
export class Reservation {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Aircraft)
  @ManyToOne(() => Aircraft, (aircraft) => aircraft.reservations)
  aircraft: Aircraft;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.reservations)
  user: User;

  @Field()
  @Column()
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

  @Field()
  @Column({ default: 'confirmed' })
  status: string;

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
