import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Aircraft } from './aircraft.entity';
import { User } from '../../users/entity/users.entity';
import type {
  CalibrationRow,
  ClimbData,
  CombinedLimit,
  CruiseData,
  DescentData,
  Envelope,
  FuelData,
  ReserveData,
  Station,
} from '../../navplan/engine/types';
import type { RunwayDistanceTable } from '../../navplan/engine/runway-distances';

// Performance and mass & balance of one aircraft, from its flight manual
// and weighing report. Not used for a plan until an administrator has
// confirmed them (validated_at). Columns match migrations
// 1797000000002-AddAircraftFlightData and 1801000000002-AddRunwayDistances
// exactly.

@Entity('aircraft_performance')
export class AircraftPerformanceEntity {
  @PrimaryColumn({
    type: 'integer',
    primaryKeyConstraintName: 'PK_aircraft_performance',
  })
  aircraft_id: number;

  @ManyToOne(() => Aircraft, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'aircraft_id',
    foreignKeyConstraintName: 'FK_aircraft_performance_aircraft',
  })
  aircraft?: Aircraft;

  @Column({ type: 'character varying', length: 32, nullable: true })
  template_code: string | null;

  @Column({ type: 'jsonb' })
  fuel: FuelData;

  @Column({ type: 'jsonb' })
  climb: ClimbData;

  @Column({ type: 'jsonb' })
  cruise: CruiseData;

  @Column({ type: 'jsonb' })
  descent: DescentData;

  @Column({ type: 'jsonb' })
  reserve: ReserveData;

  @Column({ type: 'double precision', default: 0 })
  arrival_fuel_l: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  calibration: CalibrationRow[];

  @Column({ type: 'integer', nullable: true })
  service_ceiling_ft: number | null;

  // Take-off and landing distance tables of the manual (null: not entered).
  @Column({ type: 'jsonb', nullable: true })
  takeoff: RunwayDistanceTable | null;

  @Column({ type: 'jsonb', nullable: true })
  landing: RunwayDistanceTable | null;

  @Column({ type: 'text', nullable: true })
  source: string | null;

  @Column({ type: 'integer', nullable: true })
  validated_by_id: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'validated_by_id',
    foreignKeyConstraintName: 'FK_aircraft_performance_validated_by',
  })
  validated_by?: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  validated_at: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

@Entity('aircraft_mass_balance')
export class AircraftMassBalanceEntity {
  @PrimaryColumn({
    type: 'integer',
    primaryKeyConstraintName: 'PK_aircraft_mass_balance',
  })
  aircraft_id: number;

  @ManyToOne(() => Aircraft, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'aircraft_id',
    foreignKeyConstraintName: 'FK_aircraft_mass_balance_aircraft',
  })
  aircraft?: Aircraft;

  @Column({ type: 'double precision', nullable: true })
  empty_mass_kg: number | null;

  @Column({ type: 'double precision', nullable: true })
  empty_arm_m: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  weighing_date: Date | null;

  @Column({ type: 'text', nullable: true })
  weighing_ref: string | null;

  @Column({ type: 'double precision', nullable: true })
  mtow_kg: number | null;

  @Column({ type: 'double precision', nullable: true })
  mlw_kg: number | null;

  @Column({ type: 'double precision', nullable: true })
  mzfw_kg: number | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  stations: Station[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  combined_limits: CombinedLimit[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  envelopes: Envelope[];

  @Column({ type: 'integer', nullable: true })
  validated_by_id: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'validated_by_id',
    foreignKeyConstraintName: 'FK_aircraft_mass_balance_validated_by',
  })
  validated_by?: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  validated_at: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
