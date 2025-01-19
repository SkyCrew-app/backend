import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvalService } from './eval.service';
import { Evaluation } from './entity/evaluation.entity';
import { Question } from './entity/question.entity';
import { Answer } from './entity/answer.entity';
import { Module as EModule } from '../e-learning/entity/module.entity';
import {
  EvaluationResolver,
  QuestionResolver,
  AnswerResolver,
} from './eval.resolver';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Evaluation, Question, Answer, EModule]),
    forwardRef(() => UsersModule),
  ],
  providers: [
    EvalService,
    EvaluationResolver,
    QuestionResolver,
    AnswerResolver,
  ],
  exports: [EvalService],
})
export class EvalModule {}
