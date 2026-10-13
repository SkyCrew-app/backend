import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { User } from '../../users/entity/users.entity';
import { Flight } from '../../flights/entity/flights.entity';

// Statuses an incident goes through while the club follows it up.
export const INCIDENT_STATUS_OPEN = 'Ouvert';
export const INCIDENT_STATUS_IN_PROGRESS = 'En cours';
export const INCIDENT_STATUS_RESOLVED = 'Résolu';

export const INCIDENT_STATUSES = [
  INCIDENT_STATUS_OPEN,
  INCIDENT_STATUS_IN_PROGRESS,
  INCIDENT_STATUS_RESOLVED,
];

@ObjectType()
@Entity('incidents')
export class Incident {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Aircraft)
  @ManyToOne(() => Aircraft, (aircraft) => aircraft.id)
  aircraft: Aircraft;

  @Field(() => Flight, { nullable: true })
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

  // Follow-up by the club, filled in when the incident is resolved.
  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  resolution_note: string;

  @Field({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  resolved_at: Date;

  @Field(() => User, { nullable: true })
  @ManyToOne(() => User, { nullable: true })
  resolved_by: User;
}
