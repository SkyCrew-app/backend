import { Field, Int, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LoginDeviceType, LoginMethod, LoginOutcome } from './login-events';

// One line per attempt to sign in, and per sign-out: who, when, from where,
// with what result. Never a password, a code or a token. Lines are only
// ever added; the database refuses to change them and to delete them before
// the end of the retention period (see the migration). The member is a
// plain id, not a foreign key, like in the administrator action log: the
// trace outlives the account.
@ObjectType()
@Entity('login_events')
@Index('IDX_login_events_created_at', ['created_at'])
@Index('IDX_login_events_user_created', ['user_id', 'created_at'])
@Index('IDX_login_events_outcome_created', ['outcome', 'created_at'])
export class LoginEvent {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // The member whose account was tried; null when the address matched none.
  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  user_id: number | null;

  // Only when no member has the address: what was typed, lower case.
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 120, nullable: true })
  attempted_email: string | null;

  @Field(() => LoginOutcome)
  @Column({ type: 'varchar', length: 40 })
  outcome: LoginOutcome;

  @Field(() => LoginMethod, { nullable: true })
  @Column({ type: 'varchar', length: 30, nullable: true })
  method: LoginMethod | null;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string | null;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 60, nullable: true })
  browser: string | null;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 40, nullable: true })
  os: string | null;

  @Field(() => LoginDeviceType)
  @Column({ type: 'varchar', length: 20, default: LoginDeviceType.UNKNOWN })
  device_type: LoginDeviceType;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 300, nullable: true })
  user_agent: string | null;

  // Name of the member, filled when the log is read (not stored).
  @Field({ nullable: true })
  member_name?: string | null;
}
