import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// The club's flight planning rules: a single row (id 1). Defaults are the
// AMC1 NCO.OP.125(b) minima; the API refuses anything below them. Columns
// match migration 1797000000003-AddFlightPlans exactly.
@Entity('flight_planning_settings')
export class FlightPlanningSettingsEntity {
  @PrimaryColumn({
    type: 'integer',
    primaryKeyConstraintName: 'PK_flight_planning_settings',
  })
  id: number;

  @Column({ type: 'integer', default: 10 })
  reserve_vfr_day_local_min: number;

  @Column({ type: 'integer', default: 30 })
  reserve_vfr_day_min: number;

  @Column({ type: 'integer', default: 45 })
  reserve_vfr_night_min: number;

  @Column({ type: 'double precision', default: 0 })
  contingency_percent: number;

  @Column({ type: 'double precision', default: 0 })
  contingency_min_l: number;

  @Column({ type: 'boolean', default: false })
  alternate_required_vfr: boolean;

  @Column({ type: 'integer', default: 0 })
  club_margin_min: number;

  @Column({ type: 'integer', default: 300 })
  vertical_margin_ft: number;

  @Column({ type: 'integer', default: 1000 })
  default_circuit_height_ft: number;

  @Column({ type: 'integer', default: 500 })
  default_descent_fpm: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
