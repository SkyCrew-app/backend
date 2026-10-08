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
  UpdateDateColumn,
} from 'typeorm';
import { ChecklistTemplate } from './checklist-template.entity';
import { User } from '../../users/entity/users.entity';
import { Reservation } from '../../reservations/entity/reservations.entity';
import { ChecklistResponse } from '../dto/checklist-response.type';

export enum ChecklistSubmissionStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

registerEnumType(ChecklistSubmissionStatus, {
  name: 'ChecklistSubmissionStatus',
});

@ObjectType()
@Entity('checklist_submissions')
export class ChecklistSubmission {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => ChecklistTemplate)
  @ManyToOne(() => ChecklistTemplate, (template) => template.submissions, {
    eager: true,
  })
  template: ChecklistTemplate;

  @Field(() => User)
  @ManyToOne(() => User, { eager: true })
  pilot: User;

  @Field(() => Reservation, { nullable: true })
  @ManyToOne(() => Reservation, (reservation) => reservation.checklistSubmissions, {
    nullable: true,
    eager: true,
  })
  reservation: Reservation;

  @Field(() => ChecklistSubmissionStatus)
  @Column({
    type: 'enum',
    enum: ChecklistSubmissionStatus,
    default: ChecklistSubmissionStatus.IN_PROGRESS,
  })
  status: ChecklistSubmissionStatus;

  @Field(() => [ChecklistResponse], { nullable: true })
  @Column('jsonb', { nullable: true, default: [] })
  responses: ChecklistResponse[];

  @Field()
  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  started_at: Date;

  @Field({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date;

  @Field()
  @CreateDateColumn()
  created_at: Date;

  @Field()
  @UpdateDateColumn()
  updated_at: Date;
}
