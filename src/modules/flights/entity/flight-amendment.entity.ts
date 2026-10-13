import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const FLIGHT_AMENDED = 'amended';
export const FLIGHT_DELETED = 'deleted';

// What a closed flight said before someone changed or deleted it, who did it
// and when. Plain ids, no foreign keys: the trace outlives the flight.
@Entity('flight_amendments')
export class FlightAmendment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  flight_id: number;

  @Column({ type: 'character varying' })
  action: string;

  @Column({ type: 'integer', nullable: true })
  actor_id: number | null;

  @Column({ type: 'jsonb' })
  before: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  after: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
