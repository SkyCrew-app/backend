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
  async getEvaluations(): Promise<Evaluation[]> {
    return this.evalService.getAllEvaluations();
  }

  @Query(() => Evaluation, { name: 'getEvaluationById' })
  async getEvaluationById(@Args('id') id: number): Promise<Evaluation> {
    return this.evalService.getEvaluationById(id);
  }

  @Mutation(() => Evaluation, { name: 'createEvaluation' })
  async createEvaluation(
    @Args('createEvaluationInput') createEvaluationInput: CreateEvaluationDTO,
  ): Promise<Evaluation> {
    return this.evalService.createEvaluation(createEvaluationInput);
  }

  @Mutation(() => Evaluation, { name: 'updateEvaluation' })
  async updateEvaluation(
    @Args('id') id: number,
    @Args('updateEvaluationInput') updateEvaluationInput: UpdateEvaluationDTO,
  ): Promise<Evaluation> {
    return this.evalService.updateEvaluation(id, updateEvaluationInput);
  }

  @Mutation(() => Boolean, { name: 'deleteEvaluation' })
  async deleteEvaluation(@Args('id') id: number): Promise<boolean> {
    await this.evalService.deleteEvaluation(id);
    return true;
  }

  @Query(() => [Evaluation], { name: 'getEvaluationsByModule' })
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
  async getQuestionsByEvaluation(
    @Args('evaluationId') evaluationId: number,
  ): Promise<Question[]> {
    return this.evalService.getQuestionsByEvaluation(evaluationId);
  }

  @Mutation(() => Question, { name: 'createQuestion' })
  async createQuestion(
    @Args('evaluationId') evaluationId: number,
    @Args('createQuestionInput') createQuestionInput: CreateQuestionDTO,
  ): Promise<Question> {
    const questionData = {
      content: createQuestionInput.content,
      options: createQuestionInput.options,
      correctAnswer: createQuestionInput.correct_answer,
    };
    return this.evalService.createQuestion(evaluationId, questionData);
  }

  @Mutation(() => Question, { name: 'updateQuestion' })
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
  async deleteQuestion(@Args('id') id: number): Promise<boolean> {
    await this.evalService.deleteQuestion(id);
    return true;
  }
}

@Resolver(() => Answer)
export class AnswerResolver {
  constructor(private readonly evalService: EvalService) {}

  @Mutation(() => Answer, { name: 'createAnswer' })
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
  async updateAnswer(
    @Args('id') id: number,
    @Args('updateAnswerInput') updateAnswerInput: UpdateAnswerDTO,
  ): Promise<Answer> {
    return this.evalService.updateAnswer(id, updateAnswerInput.answer_text);
  }

  @Mutation(() => Boolean, { name: 'deleteAnswer' })
  async deleteAnswer(@Args('id') id: number): Promise<boolean> {
    await this.evalService.deleteAnswer(id);
    return true;
  }

  @Mutation(() => ValidationResult, { name: 'validateAnswers' })
  async validateAnswers(
    @Args('evaluationId') evaluationId: number,
    @Args('userId') userId: number,
    @Args({ name: 'userAnswers', type: () => [UserAnswerInput] })
    userAnswers: UserAnswerInput[],
  ): Promise<ValidationResult> {
    return this.evalService.validateAnswers(evaluationId, userId, userAnswers);
  }
}
