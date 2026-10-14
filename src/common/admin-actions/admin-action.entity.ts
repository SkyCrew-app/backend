import { Field, Int, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// One line per sensitive action of an administrator: who, when, what, on
// what. Lines are only ever added (the migration also refuses UPDATE and
// DELETE in the database). The actor and the target are plain ids, not
// foreign keys: the trace outlives what it is about.
@ObjectType()
@Entity('admin_actions')
@Index('IDX_admin_actions_action_created', ['action', 'created_at'])
// Created by a migration (an expression index).
@Index('IDX_admin_actions_member', { synchronize: false })
@Index('IDX_admin_actions_created_at', ['created_at'])
@Index('IDX_admin_actions_actor', ['actor_id'])
@Index('IDX_admin_actions_target', ['target_type', 'target_id'])
export class AdminAction {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  actor_id: number | null;

  // Name of the administrator when the action was made.
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  actor_label: string | null;

  @Field()
  @Column({ type: 'varchar', length: 60 })
  action: string;

  @Field()
  @Column({ type: 'varchar', length: 40 })
  target_type: string;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  target_id: string | null;

  // Name of the target when the action was made (a member, a setting…).
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  target_label: string | null;

  // A few facts about the action. Never a secret: see sanitizeSummary.
  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  summary: Record<string, unknown> | null;
}
