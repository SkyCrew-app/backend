import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { User } from '../../users/entity/users.entity';
import { Flight } from 'src/modules/flights/entity/flights.entity';

@ObjectType()
@Entity('incidents')
export class Incident {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Aircraft)
  @ManyToOne(() => Aircraft, (aircraft) => aircraft.id)
  aircraft: Aircraft;

  @Field(() => Flight)
  @ManyToOne(() => Flight, (flight) => flight.id)
  flight: Flight;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.id)
  user: User;

  @Field()
  @Column()
  incident_date: Date;

  @Field()
  @Column()
  description: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  damage_report: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  corrective_actions: string;

  @Field()
  @Column()
  severity_level: string;

  @Field()
  @Column()
  status: string;

  @Field()
  @Column()
  priority: string;

  @Field()
  @Column()
  category: string;
}
