import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { EvalService } from './eval.service';
import { Evaluation } from './entity/evaluation.entity';
import { Question } from './entity/question.entity';
import { Answer } from './entity/answer.entity';
import { CreateEvaluationDTO } from './dto/create-evaluation.input';
import { UpdateEvaluationDTO } from './dto/update-evaluation.input';
import { CreateQuestionDTO } from './dto/create-question.input';
import { UpdateQuestionDTO } from './dto/update-question.input';
import { CreateAnswerDTO } from './dto/create-answer.input';
import { UpdateAnswerDTO } from './dto/update-answers.input';
import { UserAnswerInput } from './dto/user-answer.input';
import { ObjectType, Field } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';

@ObjectType()
class ValidationResult {
  @Field(() => Number)
  score: number;

  @Field(() => Boolean)
  passed: boolean;
}

@Resolver(() => Evaluation)
export class EvaluationResolver {
  constructor(private readonly evalService: EvalService) {}

  @Query(() => [Evaluation], { name: 'getEvaluations' })
  @UseGuards(JwtAuthGuard)
  async getEvaluations(): Promise<Evaluation[]> {
    return this.evalService.getAllEvaluations();
  }

  @Query(() => Evaluation, { name: 'getEvaluationById' })
  @UseGuards(JwtAuthGuard)
  async getEvaluationById(@Args('id') id: number): Promise<Evaluation> {
    return this.evalService.getEvaluationById(id);
  }

  @Mutation(() => Evaluation, { name: 'createEvaluation' })
  @UseGuards(JwtAuthGuard)
  async createEvaluation(
    @Args('createEvaluationInput') createEvaluationInput: CreateEvaluationDTO,
  ): Promise<Evaluation> {
    return this.evalService.createEvaluation(createEvaluationInput);
  }

  @Mutation(() => Evaluation, { name: 'updateEvaluation' })
  @UseGuards(JwtAuthGuard)
  async updateEvaluation(
    @Args('id') id: number,
    @Args('updateEvaluationInput') updateEvaluationInput: UpdateEvaluationDTO,
  ): Promise<Evaluation> {
    return this.evalService.updateEvaluation(id, updateEvaluationInput);
  }

  @Mutation(() => Boolean, { name: 'deleteEvaluation' })
  @UseGuards(JwtAuthGuard)
  async deleteEvaluation(@Args('id') id: number): Promise<boolean> {
    try {
      await this.evalService.deleteEvaluation(id);
      return true;
    } catch (error) {
      console.error(error);
      throw new Error('An error occurred while deleting the evaluation');
    }
  }

  @Query(() => [Evaluation], { name: 'getEvaluationsByModule' })
  @UseGuards(JwtAuthGuard)
  async getEvaluationsByModule(
    @Args('moduleId') moduleId: number,
  ): Promise<Evaluation[]> {
    return this.evalService.getEvaluationsByModule(moduleId);
  }
}

@Resolver(() => Question)
export class QuestionResolver {
  constructor(private readonly evalService: EvalService) {}

  @Query(() => [Question], { name: 'getQuestionsByEvaluation' })
  @UseGuards(JwtAuthGuard)
  async getQuestionsByEvaluation(
    @Args('evaluationId') evaluationId: number,
  ): Promise<Question[]> {
    return this.evalService.getQuestionsByEvaluation(evaluationId);
  }

  @Mutation(() => Question)
  @UseGuards(JwtAuthGuard)
  async createQuestion(
    @Args('evaluationId') evaluationId: number,
    @Args('createQuestionInput') createQuestionInput: CreateQuestionDTO,
  ) {
    return this.evalService.createQuestion(evaluationId, {
      content: createQuestionInput.content,
      options: createQuestionInput.options,
      correctAnswer: createQuestionInput.correct_answer,
    });
  }

  @Mutation(() => Question, { name: 'updateQuestion' })
  @UseGuards(JwtAuthGuard)
  async updateQuestion(
    @Args('id') id: number,
    @Args('updateQuestionInput') updateQuestionInput: UpdateQuestionDTO,
  ): Promise<Question> {
    const questionData = {
      content: updateQuestionInput.content,
      options: updateQuestionInput.options,
      correctAnswer: updateQuestionInput.correct_answer,
    };
    return this.evalService.updateQuestion(id, questionData);
  }

  @Mutation(() => Boolean, { name: 'deleteQuestion' })
  @UseGuards(JwtAuthGuard)
  async deleteQuestion(@Args('id') id: number): Promise<boolean> {
    await this.evalService.deleteQuestion(id);
    return true;
  }
}

@Resolver(() => Answer)
export class AnswerResolver {
  constructor(private readonly evalService: EvalService) {}

  @Mutation(() => Answer, { name: 'createAnswer' })
  @UseGuards(JwtAuthGuard)
  async createAnswer(
    @Args('userId') userId: number,
    @Args('questionId') questionId: number,
    @Args('createAnswerInput') createAnswerInput: CreateAnswerDTO,
  ): Promise<Answer> {
    return this.evalService.createAnswer(
      userId,
      questionId,
      createAnswerInput.answer_text,
    );
  }

  @Mutation(() => Answer, { name: 'updateAnswer' })
  @UseGuards(JwtAuthGuard)
  async updateAnswer(
    @Args('id') id: number,
    @Args('updateAnswerInput') updateAnswerInput: UpdateAnswerDTO,
  ): Promise<Answer> {
    return this.evalService.updateAnswer(id, updateAnswerInput.answer_text);
  }

  @Mutation(() => Boolean, { name: 'deleteAnswer' })
  @UseGuards(JwtAuthGuard)
  async deleteAnswer(@Args('id') id: number): Promise<boolean> {
    await this.evalService.deleteAnswer(id);
    return true;
  }

  @Mutation(() => ValidationResult, { name: 'validateAnswers' })
  @UseGuards(JwtAuthGuard)
  async validateAnswers(
    @Args('evaluationId') evaluationId: number,
    @Args('userId') userId: number,
    @Args({ name: 'userAnswers', type: () => [UserAnswerInput] })
    userAnswers: UserAnswerInput[],
  ): Promise<ValidationResult> {
    return this.evalService.validateAnswers(evaluationId, userId, userAnswers);
  }
}
