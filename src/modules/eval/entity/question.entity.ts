import { ObjectType, Field, Int } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Evaluation } from './evaluation.entity';
import { Answer } from './answer.entity';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
@Entity('questions')
export class Question {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => GraphQLJSON, { description: 'Rich content in JSON format' })
  @Column('jsonb')
  content: any;

  @Field(() => [String])
  @Column('simple-array')
  options: string[];

  @Field()
  @Column()
  correct_answer: string;

  @Field(() => Evaluation)
  @ManyToOne(() => Evaluation, (evaluation) => evaluation.questions, {
    onDelete: 'CASCADE',
  })
  evaluation: Evaluation;

  @Field(() => [Answer], { description: 'The answers to the question' })
  @OneToMany(() => Answer, (answer) => answer.question, { cascade: true })
  answers: Answer[];
}
