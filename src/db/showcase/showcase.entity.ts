import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// Columns match migration 1797100000001-AddShowcaseTracking exactly.

// One row per row the showcase generator wrote: its table and its primary
// key, as text.
@Entity('showcase_items')
export class ShowcaseItem {
  @PrimaryColumn({
    type: 'character varying',
    length: 63,
    primaryKeyConstraintName: 'PK_showcase_items',
  })
  entity: string;

  @PrimaryColumn({
    type: 'character varying',
    length: 64,
    primaryKeyConstraintName: 'PK_showcase_items',
  })
  row_id: string;
}

// The showcase that exists, if any (a single row, id 1).
@Entity('showcase_state')
export class ShowcaseState {
  @PrimaryColumn({
    type: 'integer',
    primaryKeyConstraintName: 'PK_showcase_state',
  })
  id: number;

  @Column({ type: 'integer' })
  seed: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'character varying', length: 8 })
  invoice_prefix: string;

  @Column({ type: 'integer', default: 0 })
  invoice_last_number: number;

  @Column({ type: 'jsonb', nullable: true })
  summary: Record<string, unknown> | null;
}
