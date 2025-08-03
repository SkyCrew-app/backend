import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { AuditTemplate } from './audit-template.entity';
import { AuditCategoryType } from '../enums/audit-category.enum';
import { CriticalityLevel } from '../enums/criticality-level.enum';

@ObjectType()
@Entity('audit_template_items')
export class AuditTemplateItem {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => AuditTemplate)
  @ManyToOne(() => AuditTemplate, (template) => template.items, {
    onDelete: 'CASCADE',
  })
  template: AuditTemplate;

  @Field(() => Int)
  @Column()
  order_index: number;

  @Field(() => AuditCategoryType)
  @Column({
    type: 'enum',
    enum: AuditCategoryType,
  })
  category: AuditCategoryType;

  @Field()
  @Column()
  title: string;

  @Field()
  @Column({ type: 'text' })
  description: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  inspection_method: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  expected_result: string;

  @Field(() => CriticalityLevel)
  @Column({
    type: 'enum',
    enum: CriticalityLevel,
    default: CriticalityLevel.MINEUR,
  })
  criticality: CriticalityLevel;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  reference_documentation: string;

  @Field(() => Boolean, { defaultValue: false })
  @Column({ default: false })
  requires_photo_evidence: boolean;

  @Field(() => Boolean, { defaultValue: true })
  @Column({ default: true })
  is_mandatory: boolean;
}
