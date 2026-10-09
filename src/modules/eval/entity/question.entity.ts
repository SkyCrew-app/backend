import { ObjectType, Field, Int, FieldMiddleware } from '@nestjs/graphql';
import {
  hasRole,
  ROLE_ADMIN,
  ROLE_INSTRUCTOR,
} from '../../../common/auth/access';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Evaluation } from './evaluation.entity';
import { Answer } from './answer.entity';
import GraphQLJSON from 'graphql-type-json';

// Resolves a field to `hidden` unless the caller is an instructor or an
// administrator.
const staffOnly =
  (hidden: unknown): FieldMiddleware =>
  async (ctx, next) => {
    const value = await next();
    const user = ctx.context?.req?.user;
    return hasRole(user, ROLE_ADMIN, ROLE_INSTRUCTOR) ? value : hidden;
  };

@ObjectType()
@Entity('questions')
export class Question {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => GraphQLJSON, { description: 'Rich content in JSON format' })
  @Column('jsonb')
  content: object;

  @Field(() => [String])
  @Column('simple-array')
  options: string[];

  // Students answer without seeing the key: scoring happens on the server.
  @Field({ nullable: true, middleware: [staffOnly(null)] })
  @Column()
  correct_answer: string;

  @Column({ name: 'evaluation_id' })
  evaluationId: number;

  @ManyToOne(() => Evaluation, (evaluation) => evaluation.questions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluation_id' })
  evaluation: Evaluation;

  // Answers recorded by every user: for the staff who correct them.
  @Field(() => [Answer], {
    description: 'The answers to the question',
    middleware: [staffOnly([])],
  })
  @OneToMany(() => Answer, (answer) => answer.question, { cascade: true })
  answers: Answer[];
}
