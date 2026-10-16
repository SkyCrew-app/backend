import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Flight } from '../../flights/entity/flights.entity';
import { User } from '../../users/entity/users.entity';
import { Reservation } from '../../reservations/entity/reservations.entity';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';

// A flight plan of the new engine: what the pilot entered and the result
// frozen when it was saved. Columns match migration
// 1797000000003-AddFlightPlans exactly.
@Entity('flight_plans')
@Index('IDX_flight_plans_user', ['user_id'])
@Unique('UQ_flight_plans_flight', ['flight_id'])
export class FlightPlanEntity {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_flight_plans' })
  id: number;

  @Column({ type: 'integer', nullable: true })
  flight_id: number | null;

  @ManyToOne(() => Flight, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({
    name: 'flight_id',
    foreignKeyConstraintName: 'FK_flight_plans_flight',
  })
  flight?: Flight | null;

  @Column({ type: 'integer', nullable: true })
  reservation_id: number | null;

  @ManyToOne(() => Reservation, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'reservation_id',
    foreignKeyConstraintName: 'FK_flight_plans_reservation',
  })
  reservation?: Reservation | null;

  @Column({ type: 'integer' })
  user_id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_flight_plans_user',
  })
  user?: User;

  @Column({ type: 'integer', nullable: true })
  aircraft_id: number | null;

  @ManyToOne(() => Aircraft, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'aircraft_id',
    foreignKeyConstraintName: 'FK_flight_plans_aircraft',
  })
  aircraft?: Aircraft | null;

  @Column({ type: 'jsonb' })
  input: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  result: Record<string, unknown>;

  @Column({ type: 'character varying', length: 32 })
  engine_version: string;

  @Column({ type: 'character varying', length: 16, nullable: true })
  navdata_airac: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  weather_fetched_at: Date | null;

  @Column({ type: 'character varying', length: 16 })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
