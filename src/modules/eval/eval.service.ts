import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evaluation } from './entity/evaluation.entity';
import { Question } from './entity/question.entity';
import { UsersService } from '../users/users.service';
import { calculateScore } from '../../shared/utils/calculate-score.util';
import { Answer } from './entity/answer.entity';
import { CreateEvaluationDTO } from './dto/create-evaluation.input';
import { Module } from '../e-learning/entity/module.entity';

@Injectable()
export class EvalService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
    @InjectRepository(Answer)
    private readonly answerRepository: Repository<Answer>,
    @InjectRepository(Module)
    private readonly moduleRepository: Repository<Module>,
    private readonly userProgressService: UsersService,
  ) {}

  async validateAnswers(
    evaluationId: number,
    userId: number,
    userAnswers: { questionId: number; answer: string }[],
  ): Promise<{ score: number; passed: boolean }> {
    const evaluation = await this.evaluationRepository.findOne({
      where: { id: evaluationId },
      relations: ['questions'],
    });

    if (!evaluation) {
      throw new Error('Evaluation not found');
    }

    const correctCount = userAnswers.filter((ua) => {
      const question = evaluation.questions.find((q) => q.id === ua.questionId);
      return question && question.correct_answer === ua.answer;
    }).length;

    const totalQuestions = evaluation.questions.length;
    const score = calculateScore(correctCount, totalQuestions);
    const passed = score >= evaluation.pass_score;

    await this.userProgressService.saveEvaluationResult(
      userId,
      evaluationId,
      score,
      passed,
    );

    return { score, passed };
  }

  async getEvaluationsByModule(moduleId: number): Promise<Evaluation[]> {
    return this.evaluationRepository.find({
      where: { module: { id: moduleId } },
      relations: ['questions'],
    });
  }

  // Récupérer une évaluation avec ses questions
  async getEvaluationById(evaluationId: number): Promise<Evaluation> {
    return this.evaluationRepository.findOne({
      where: { id: evaluationId },
      relations: ['questions', 'module'],
    });
  }

  // Récupérer toutes les évaluations
  async getAllEvaluations(): Promise<Evaluation[]> {
    return this.evaluationRepository.find({
      relations: ['questions', 'module'],
    });
  }

  // Suivre les résultats d'un utilisateur
  async getUserEvaluationResults(userId: number): Promise<any[]> {
    return this.userProgressService.getEvaluationResults(userId);
  }

  // Créer une nouvelle évaluation
  async createEvaluation(
    createEvaluationInput: CreateEvaluationDTO,
  ): Promise<Evaluation> {
    const { moduleId, pass_score } = createEvaluationInput;

    const module = await this.moduleRepository.findOne({
      where: { id: moduleId },
    });
    if (!module) {
      throw new NotFoundException(`Module with ID ${moduleId} not found`);
    }

    const evaluation = this.evaluationRepository.create({
      pass_score,
      module,
    });

    return this.evaluationRepository.save(evaluation);
  }

  // Mettre à jour une évaluation
  async updateEvaluation(
    evaluationId: number,
    evaluationData: Partial<Evaluation>,
  ): Promise<Evaluation> {
    await this.evaluationRepository.update(evaluationId, evaluationData);
    return this.getEvaluationById(evaluationId);
  }

  // Supprimer une évaluation
  async deleteEvaluation(evaluationId: number): Promise<void> {
    await this.evaluationRepository.delete(evaluationId);
  }

  // Créer une nouvelle question
  async createQuestion(
    evaluationId: number,
    questionData: { content: any; options: string[]; correctAnswer: string },
  ): Promise<Question> {
    if (!questionData.options.includes(questionData.correctAnswer)) {
      throw new Error('Correct answer must be one of the options.');
    }

    const evaluation = await this.evaluationRepository.findOne({
      where: { id: evaluationId },
    });

    if (!evaluation) {
      throw new Error('Evaluation not found');
    }

    const question = this.questionRepository.create({
      content: questionData.content,
      options: questionData.options,
      correct_answer: questionData.correctAnswer,
      evaluation,
    });

    return this.questionRepository.save(question);
  }

  // Mettre à jour une question existante
  async updateQuestion(
    questionId: number,
    questionData: Partial<{
      content: any;
      options: string[];
      correctAnswer: string;
    }>,
  ): Promise<Question> {
    const question = await this.questionRepository.findOne({
      where: { id: questionId },
    });

    if (!question) {
      throw new Error('Question not found');
    }

    if (
      questionData.correctAnswer &&
      !questionData.options?.includes(questionData.correctAnswer)
    ) {
      throw new Error('Correct answer must be one of the updated options.');
    }

    Object.assign(question, questionData);

    return this.questionRepository.save(question);
  }

  // Supprimer une question
  async deleteQuestion(questionId: number): Promise<void> {
    await this.questionRepository.delete(questionId);
  }

  // Créer une réponse utilisateur
  async createAnswer(
    userId: number,
    questionId: number,
    answerText: string,
  ): Promise<Answer> {
    const question = await this.questionRepository.findOne({
      where: { id: questionId },
    });

    if (!question) {
      throw new Error('Question not found');
    }

    if (!question.options.includes(answerText)) {
      throw new Error('Answer must be one of the provided options.');
    }

    const answer = this.answerRepository.create({
      user: { id: userId },
      question,
      answer_text: answerText,
      is_correct: question.correct_answer === answerText,
    });

    return this.answerRepository.save(answer);
  }

  // Modifier une réponse utilisateur
  async updateAnswer(answerId: number, newAnswerText: string): Promise<Answer> {
    const answer = await this.answerRepository.findOne({
      where: { id: answerId },
      relations: ['question'],
    });

    if (!answer) {
      throw new Error('Answer not found');
    }

    answer.answer_text = newAnswerText;
    answer.is_correct = answer.question.correct_answer === newAnswerText;

    return this.answerRepository.save(answer);
  }

  // Supprimer une réponse utilisateur
  async deleteAnswer(answerId: number): Promise<void> {
    await this.answerRepository.delete(answerId);
  }

  // Récupérer toutes les questions d'une évaluation
  async getQuestionsByEvaluation(evaluationId: number): Promise<Question[]> {
    return this.questionRepository.find({
      where: { evaluation: { id: evaluationId } },
      relations: ['answers'],
    });
  }
}
