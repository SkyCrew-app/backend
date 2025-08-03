import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { AuditResultType } from '../enums/audit-result.enum';
import { AuditCategoryType } from '../enums/audit-category.enum';

@ObjectType()
@Entity('audit_items')
export class AuditItem {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => AuditCategoryType)
  @Column({
    type: 'enum',
    enum: AuditCategoryType,
    default: AuditCategoryType.AUTRE,
  })
  category: AuditCategoryType;

  @Field()
  @Column()
  description: string;

  @Field(() => AuditResultType)
  @Column({
    type: 'enum',
    enum: AuditResultType,
    default: AuditResultType.CONFORME,
  })
  result: AuditResultType;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string;

  @Field(() => Boolean, { defaultValue: false })
  @Column({ default: false })
  requires_action: boolean;
}
