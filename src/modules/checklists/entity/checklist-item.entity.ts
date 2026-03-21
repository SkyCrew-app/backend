import {
  ObjectType,
  Field,
  Int,
  registerEnumType,
} from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { ChecklistTemplate } from './checklist-template.entity';

export enum ChecklistCategory {
  EXTERIOR = 'exterior',
  COCKPIT = 'cockpit',
  ENGINE = 'engine',
  EMERGENCY = 'emergency',
  DOCUMENTS = 'documents',
}

registerEnumType(ChecklistCategory, {
  name: 'ChecklistCategory',
});

@ObjectType()
@Entity('checklist_items')
export class ChecklistItem {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => ChecklistTemplate)
  @ManyToOne(() => ChecklistTemplate, (template) => template.items, {
    onDelete: 'CASCADE',
  })
  template: ChecklistTemplate;

  @Field(() => ChecklistCategory)
  @Column({
    type: 'enum',
    enum: ChecklistCategory,
  })
  category: ChecklistCategory;

  @Field()
  @Column()
  item_name: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  description: string;

  @Field(() => Boolean)
  @Column({ default: true })
  is_required: boolean;

  @Field(() => Int)
  @Column()
  sort_order: number;

  @Field()
  @CreateDateColumn()
  created_at: Date;
}
