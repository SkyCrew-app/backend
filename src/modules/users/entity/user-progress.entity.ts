import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entity/users.entity';
import { Lesson } from '../../e-learning/entity/lesson.entity';
import { Evaluation } from '../../eval/entity/evaluation.entity';
import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
@Entity('user_progress')
export class UserProgress {
  @PrimaryGeneratedColumn()
  @Field(() => Number, { description: 'The unique ID of the user progress' })
  id: number;

  @ManyToOne(() => User, (user) => user.userProgresses)
  @JoinColumn()
  user: User;

  @ManyToOne(() => Lesson, { nullable: true })
  @JoinColumn()
  lesson?: Lesson;

  @Field(() => Evaluation, {
    description: 'The evaluations completed by the user',
    nullable: true,
  })
  @ManyToOne(() => Evaluation, (evaluation) => evaluation.userProgress, {
    cascade: true,
  })
  @JoinColumn()
  evaluation?: Evaluation;

  @Field(() => Boolean)
  @Column({ type: 'boolean', default: false })
  completed?: boolean;

  @Field(() => Number, { nullable: true })
  @Column({ type: 'float', nullable: true })
  score?: number;

  @Field(() => Boolean)
  @Column({ type: 'boolean', default: false })
  passed?: boolean;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  completed_at?: Date;
}
