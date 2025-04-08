import { ObjectType, Field, Int } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { Module } from '../../e-learning/entity/module.entity';
import { Question } from './question.entity';
import { UserProgress } from '../../users/entity/user-progress.entity';

@ObjectType()
@Entity('evaluations')
export class Evaluation {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Module)
  @ManyToOne(() => Module, (module) => module.evaluations, {
    onDelete: 'CASCADE',
  })
  module: Module;

  @Field(() => [Question])
  @OneToMany(() => Question, (question) => question.evaluation, {
    onDelete: 'CASCADE',
  })
  questions: Question[];

  @Field()
  @Column({ default: 0 })
  pass_score: number;

  @Field(() => UserProgress, { nullable: true })
  @OneToMany(() => UserProgress, (progress) => progress.evaluation)
  userProgress: UserProgress;
}
