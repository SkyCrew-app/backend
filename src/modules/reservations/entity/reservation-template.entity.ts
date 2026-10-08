import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { User } from '../../users/entity/users.entity';
import { FlightCategory } from './reservations.entity';

@ObjectType()
@Entity('reservation_templates')
export class ReservationTemplate {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column()
  name: string;

  @Field(() => User)
  @ManyToOne(() => User, { eager: true })
  user: User;

  @Field(() => Aircraft, { nullable: true })
  @ManyToOne(() => Aircraft, { eager: true, nullable: true })
  aircraft: Aircraft;

  @Field(() => Int, { nullable: true })
  @Column({ nullable: true })
  day_of_week: number;

  @Field({ nullable: true })
  @Column({ nullable: true })
  preferred_start_time: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  preferred_end_time: string;

  @Field(() => FlightCategory)
  @Column({
    type: 'enum',
    enum: FlightCategory,
    default: FlightCategory.LOCAL,
  })
  flight_category: FlightCategory;

  @Field({ nullable: true })
  @Column({ nullable: true })
  purpose: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  notes: string;

  @Field(() => Float, { nullable: true })
  @Column('float', { nullable: true })
  estimated_flight_hours: number;

  @Field()
  @CreateDateColumn()
  created_at: Date;
}
