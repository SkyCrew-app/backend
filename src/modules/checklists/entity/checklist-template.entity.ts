import { ObjectType, Field, Int } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entity/users.entity';
import { ChecklistItem } from './checklist-item.entity';

@ObjectType()
@Entity('checklist_templates')
export class ChecklistTemplate {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column()
  aircraft_model: string;

  @Field()
  @Column()
  name: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  description: string;

  @Field(() => Boolean)
  @Column({ default: true })
  is_active: boolean;

  @Field(() => User)
  @ManyToOne(() => User, { eager: true })
  created_by: User;

  @Field(() => [ChecklistItem], { nullable: true })
  @OneToMany(() => ChecklistItem, (item) => item.template, { cascade: true })
  items: ChecklistItem[];

  // Use string-based relation to avoid circular import with ChecklistSubmission
  @OneToMany('ChecklistSubmission', 'template')
  submissions: any[];

  @Field()
  @CreateDateColumn()
  created_at: Date;

  @Field()
  @UpdateDateColumn()
  updated_at: Date;
}
