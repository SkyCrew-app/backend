import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Question } from './question.entity';
import { User } from '../../users/entity/users.entity';

@ObjectType()
@Entity('answers')
export class Answer {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => String, {
    nullable: true,
    description: 'The user-provided answer text',
  })
  @Column({ nullable: true })
  answer_text: string;

  @Field(() => Boolean, { description: 'Indicates if the answer is correct' })
  @Column({ default: false })
  is_correct: boolean;

  @Field(() => User, { description: 'The user who provided the answer' })
  @ManyToOne(() => User, (user) => user.answers, { onDelete: 'CASCADE' })
  user: User;

  @Field(() => Question, { description: 'The question being answered' })
  @ManyToOne(() => Question, (question) => question.answers, {
    onDelete: 'CASCADE',
  })
  question: Question;

  @Field(() => Date, { description: 'The date the answer was submitted' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  submitted_at: Date;
}
