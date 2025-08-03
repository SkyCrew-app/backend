import { ObjectType, Field, Int } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { User } from '../../users/entity/users.entity';
import { AuditResultType } from '../enums/audit-result.enum';
import { AuditFrequencyType } from '../enums/audit-frequency.enum';
import { AuditItem } from './audit-item.entity';

@ObjectType()
@Entity('audits')
export class Audit {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Aircraft)
  @ManyToOne(() => Aircraft, (aircraft) => aircraft.audits, { eager: true })
  aircraft: Aircraft;

  @Field()
  @Column()
  audit_date: Date;

  @Field(() => AuditResultType)
  @Column({
    type: 'enum',
    enum: AuditResultType,
    default: AuditResultType.CONFORME,
  })
  audit_result: AuditResultType;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  audit_notes: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  corrective_actions: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  next_audit_date: Date;

  @Field(() => AuditFrequencyType)
  @Column({
    type: 'enum',
    enum: AuditFrequencyType,
    default: AuditFrequencyType.ANNUEL,
  })
  audit_frequency: AuditFrequencyType;

  @Field(() => User)
  @ManyToOne(() => User, { eager: true })
  auditor: User;

  @Field(() => [AuditItem], { nullable: true })
  @ManyToMany(() => AuditItem)
  @JoinTable()
  audit_items: AuditItem[];

  @Field(() => Boolean, { defaultValue: false })
  @Column({ default: false })
  is_closed: boolean;

  @Field(() => Date, { nullable: true })
  @Column({ nullable: true })
  closed_date: Date;

  @Field(() => User, { nullable: true })
  @ManyToOne(() => User, { nullable: true })
  closed_by: User;

  @Field()
  @CreateDateColumn()
  created_at: Date;

  @Field()
  @UpdateDateColumn()
  updated_at: Date;
}
