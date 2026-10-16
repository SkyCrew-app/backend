import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

// The navigation data of the installation, one set per AIRAC cycle. The
// columns match migration 1797000000001-AddNavdata exactly.

export type CycleStatus = 'STAGED' | 'ACTIVE' | 'RETIRED' | 'REJECTED';

@Entity('navdata_cycles')
export class NavdataCycle {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_navdata_cycles' })
  id: number;

  // AIRAC identifier ("2611"), or "OURAIRPORTS" for aerodromes only.
  @Column({ type: 'character varying', length: 16 })
  airac: string;

  @Column({ type: 'timestamptz' })
  effective_from: Date;

  @Column({ type: 'timestamptz' })
  effective_to: Date;

  @Column({ type: 'text' })
  source: string;

  @Column({ type: 'character varying', length: 16 })
  status: CycleStatus;

  // Whether the cycle carries SIA data (airspaces, navaids, VFR points).
  @Column({ type: 'boolean', default: false })
  has_sia: boolean;

  @Column({ type: 'character varying', length: 64, nullable: true })
  sha256: string | null;

  @Column({ type: 'jsonb', nullable: true })
  report: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  imported_at: Date;
}

@Entity('nav_points')
@Index('IDX_nav_points_cycle_ident', ['cycle_id', 'ident'])
@Index('IDX_nav_points_cycle_lat_lon', ['cycle_id', 'lat', 'lon'])
export class NavPointEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'gen_random_uuid()',
    primaryKeyConstraintName: 'PK_nav_points',
  })
  id: string;

  // Null for the points a club adds itself (kept from one cycle to the next).
  @Column({ type: 'integer', nullable: true })
  cycle_id: number | null;

  @ManyToOne(() => NavdataCycle, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({
    name: 'cycle_id',
    foreignKeyConstraintName: 'FK_nav_points_cycle',
  })
  cycle?: NavdataCycle;

  @Column({ type: 'character varying', length: 16 })
  type: string;

  @Column({ type: 'character varying', length: 32 })
  ident: string;

  @Column({ type: 'text', nullable: true })
  name: string | null;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lon: number;

  @Column({ type: 'integer', nullable: true })
  elevation_ft: number | null;

  @Column({ type: 'character varying', length: 16, nullable: true })
  frequency: string | null;

  @Column({ type: 'character varying', length: 2, nullable: true })
  country: string | null;

  @Column({ type: 'character varying', length: 8, nullable: true })
  aerodrome_icao: string | null;

  @Column({ type: 'boolean', nullable: true })
  vrp_mandatory: boolean | null;

  @Column({ type: 'character varying', length: 16 })
  source: string;

  @Column({ type: 'character varying', length: 64, nullable: true })
  source_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  extra: Record<string, any> | null;
}

@Entity('airspaces')
@Index('IDX_airspaces_cycle_box', [
  'cycle_id',
  'min_lat',
  'max_lat',
  'min_lon',
  'max_lon',
])
export class AirspaceEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'gen_random_uuid()',
    primaryKeyConstraintName: 'PK_airspaces',
  })
  id: string;

  @Column({ type: 'integer' })
  cycle_id: number;

  @ManyToOne(() => NavdataCycle, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'cycle_id',
    foreignKeyConstraintName: 'FK_airspaces_cycle',
  })
  cycle?: NavdataCycle;

  @Column({ type: 'character varying', length: 96 })
  source_id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'character varying', length: 16 })
  type: string;

  @Column({ type: 'character varying', length: 1, nullable: true })
  icao_class: string | null;

  @Column({ type: 'character varying', length: 4 })
  floor_ref: string;

  @Column({ type: 'integer' })
  floor_value: number;

  @Column({ type: 'character varying', length: 4 })
  ceiling_ref: string;

  @Column({ type: 'integer' })
  ceiling_value: number;

  @Column({ type: 'jsonb' })
  geometry: number[][][][];

  @Column({ type: 'double precision' })
  min_lat: number;

  @Column({ type: 'double precision' })
  max_lat: number;

  @Column({ type: 'double precision' })
  min_lon: number;

  @Column({ type: 'double precision' })
  max_lon: number;

  @Column({ type: 'text', nullable: true })
  activity: string | null;

  @Column({ type: 'character varying', length: 16, nullable: true })
  schedule_code: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  frequencies: { service: string; callsign: string | null; mhz: string }[];

  @Column({ type: 'text', nullable: true })
  remarks: string | null;
}
