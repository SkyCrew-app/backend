import { ObjectType, Field, Int } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entity/users.entity';
import { AuditFrequencyType } from '../enums/audit-frequency.enum';
import { AuditTemplateItem } from './audit-template-item.entity';

@ObjectType()
@Entity('audit_templates')
export class AuditTemplate {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column()
  name: string;

  @Field()
  @Column({ type: 'text' })
  description: string;

  @Field(() => AuditFrequencyType)
  @Column({
    type: 'enum',
    enum: AuditFrequencyType,
    default: AuditFrequencyType.ANNUEL,
  })
  recommended_frequency: AuditFrequencyType;

  @Field(() => [String], { nullable: true })
  @Column('simple-array', { nullable: true })
  applicable_aircraft_types: string[];

  @Field(() => Boolean, { defaultValue: true })
  @Column({ default: true })
  is_active: boolean;

  @Field(() => User)
  @ManyToOne(() => User)
  created_by: User;

  @Field()
  @CreateDateColumn()
  created_at: Date;

  @Field()
  @UpdateDateColumn()
  updated_at: Date;

  @Field(() => [AuditTemplateItem])
  @OneToMany(() => AuditTemplateItem, (item) => item.template, {
    cascade: true,
    eager: true,
  })
  items: AuditTemplateItem[];

  @Field(() => Int)
  @Column({ default: 1 })
  version: number;
}
