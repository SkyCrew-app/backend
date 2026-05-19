import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EvalService } from '../eval.service';
import { Evaluation } from '../entity/evaluation.entity';
import { Question } from '../entity/question.entity';
import { Answer } from '../entity/answer.entity';
import { Module } from '../../e-learning/entity/module.entity';
import { UsersService } from '../../users/users.service';
import { NotFoundException } from '@nestjs/common';

describe('EvalService', () => {
  let service: EvalService;
  let evalRepo: Partial<Record<keyof Repository<Evaluation>, jest.Mock>>;
  let questionRepo: Partial<Record<keyof Repository<Question>, jest.Mock>>;
  let answerRepo: Partial<Record<keyof Repository<Answer>, jest.Mock>>;
  let moduleRepo: Partial<Record<keyof Repository<Module>, jest.Mock>>;
  let userService: Partial<UsersService>;

  beforeEach(async () => {
    evalRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    questionRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    answerRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    moduleRepo = {
      findOne: jest.fn(),
    };
    userService = {
      saveEvaluationResult: jest.fn(),
      getEvaluationResults: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EvalService,
        { provide: getRepositoryToken(Evaluation), useValue: evalRepo },
        { provide: getRepositoryToken(Question), useValue: questionRepo },
        { provide: getRepositoryToken(Answer), useValue: answerRepo },
        { provide: getRepositoryToken(Module), useValue: moduleRepo },
        { provide: UsersService, useValue: userService },
      ],
    }).compile();

    service = moduleRef.get<EvalService>(EvalService);
  });

  describe('validateAnswers', () => {
    it('calculates score and passes result', async () => {
      const evaluation: any = {
        id: 1,
        questions: [
          { id: 10, correct_answer: 'A' },
          { id: 11, correct_answer: 'B' },
        ],
        pass_score: 50,
      };
      evalRepo.findOne.mockResolvedValue(evaluation);
      const userAnswers = [
        { questionId: 10, answer: 'A' },
        { questionId: 11, answer: 'C' },
      ];
      (userService.saveEvaluationResult as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.validateAnswers(1, 5, userAnswers);
      expect(result.score).toBe(50);
      expect(result.passed).toBe(true);
      expect(userService.saveEvaluationResult).toHaveBeenCalledWith(
        5,
        1,
        50,
        true,
      );
    });

    it('throws if evaluation not found', async () => {
      evalRepo.findOne.mockResolvedValue(undefined);
      await expect(service.validateAnswers(99, 5, [])).rejects.toThrow(
        'Evaluation not found',
      );
    });
  });

  describe('getAllEvaluations and getEvaluationById', () => {
    it('returns all evaluations', async () => {
      const list = [{ id: 2 }] as Evaluation[];
      evalRepo.find.mockResolvedValue(list);
      const res = await service.getAllEvaluations();
      expect(res).toBe(list);
    });

    it('returns evaluation by id', async () => {
      const ev = { id: 3 } as Evaluation;
      evalRepo.findOne.mockResolvedValue(ev);
      const res = await service.getEvaluationById(3);
      expect(res).toBe(ev);
    });
  });

  describe('getUserEvaluationResults', () => {
    it('delegates to userService', async () => {
      const results = [{ score: 80 }];
      (userService.getEvaluationResults as jest.Mock).mockResolvedValue(
        results,
      );
      const res = await service.getUserEvaluationResults(7);
      expect(res).toBe(results);
    });
  });

  describe('createEvaluation', () => {
    it('creates and saves evaluation', async () => {
      const mod = { id: 4 } as any;
      const newEval = { id: 5, pass_score: 60, module: mod } as any;
      moduleRepo.findOne.mockResolvedValue(mod);
      evalRepo.create.mockReturnValue(newEval);
      evalRepo.save.mockResolvedValue(newEval);

      const res = await service.createEvaluation({
        moduleId: 4,
        pass_score: 60,
      } as any);
      expect(evalRepo.create).toHaveBeenCalledWith({
        pass_score: 60,
        module: mod,
      });
      expect(evalRepo.save).toHaveBeenCalledWith(newEval);
      expect(res).toBe(newEval);
    });

    it('throws if module missing', async () => {
      moduleRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createEvaluation({ moduleId: 99, pass_score: 70 } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateEvaluation and deleteEvaluation', () => {
    it('updates evaluation', async () => {
      evalRepo.update.mockResolvedValue(undefined);
      const ev = { id: 6 } as Evaluation;
      evalRepo.findOne.mockResolvedValue(ev);
      const res = await service.updateEvaluation(6, { pass_score: 80 } as any);
      expect(evalRepo.update).toHaveBeenCalledWith(6, { pass_score: 80 });
      expect(res).toBe(ev);
    });

    it('deletes evaluation', async () => {
      evalRepo.delete.mockResolvedValue(undefined);
      await expect(service.deleteEvaluation(7)).resolves.toBeUndefined();
      expect(evalRepo.delete).toHaveBeenCalledWith(7);
    });
  });

  describe('questions CRUD', () => {
    it('creates question', async () => {
      const ev = { id: 8 } as any;
      const questionData = {
        content: {},
        options: ['A', 'B'],
        correctAnswer: 'A',
      };
      evalRepo.findOne.mockResolvedValue(ev);
      const newQ = { id: 9 } as any;
      questionRepo.create.mockReturnValue(newQ);
      questionRepo.save.mockResolvedValue(newQ);

      const res = await service.createQuestion(8, questionData);
      expect(questionRepo.create).toHaveBeenCalledWith({
        content: questionData.content,
        options: questionData.options,
        correct_answer: questionData.correctAnswer,
        evaluation: ev,
      });
      expect(res).toBe(newQ);
    });

    it('throws if correctAnswer not in options', async () => {
      const questionData = { content: {}, options: ['A'], correctAnswer: 'B' };
      await expect(service.createQuestion(1, questionData)).rejects.toThrow(
        'Failed to create question',
      );
    });

    it('updates question', async () => {
      const q = { id: 10, options: ['X'], correct_answer: 'X' } as any;
      questionRepo.findOne.mockResolvedValue(q);
      questionRepo.save.mockResolvedValue(q);
      const res = await service.updateQuestion(10, {
        correctAnswer: 'X',
        options: ['X'],
      } as any);
      expect(res).toBe(q);
    });

    it('throws if question not found', async () => {
      questionRepo.findOne.mockResolvedValue(undefined);
      await expect(service.updateQuestion(99, {} as any)).rejects.toThrow(
        'Question not found',
      );
    });

    it('deletes question', async () => {
      questionRepo.delete.mockResolvedValue(undefined);
      await expect(service.deleteQuestion(11)).resolves.toBeUndefined();
      expect(questionRepo.delete).toHaveBeenCalledWith(11);
    });
  });

  describe('answers CRUD', () => {
    it('creates answer', async () => {
      const q = { id: 12, options: ['A'], correct_answer: 'A' } as any;
      questionRepo.findOne.mockResolvedValue(q);
      const newA = { id: 13 } as any;
      answerRepo.create.mockReturnValue(newA);
      answerRepo.save.mockResolvedValue(newA);

      const res = await service.createAnswer(1, 12, 'A');
      expect(answerRepo.create).toHaveBeenCalledWith({
        user: { id: 1 },
        question: q,
        answer_text: 'A',
        is_correct: true,
      });
      expect(res).toBe(newA);
    });

    it('throws if question not found', async () => {
      questionRepo.findOne.mockResolvedValue(undefined);
      await expect(service.createAnswer(1, 99, 'A')).rejects.toThrow(
        'Question not found',
      );
    });

    it('throws if answer not in options', async () => {
      const q = { id: 14, options: ['X'], correct_answer: 'X' } as any;
      questionRepo.findOne.mockResolvedValue(q);
      await expect(service.createAnswer(1, 14, 'Y')).rejects.toThrow(
        'Answer must be one of the provided options.',
      );
    });

    it('updates answer', async () => {
      const a = { id: 15, question: { correct_answer: 'Z' } } as any;
      answerRepo.findOne.mockResolvedValue(a);
      answerRepo.save.mockResolvedValue(a);
      const res = await service.updateAnswer(15, 'Z');
      expect(res).toBe(a);
    });

    it('throws if answer not found', async () => {
      answerRepo.findOne.mockResolvedValue(undefined);
      await expect(service.updateAnswer(99, 'A')).rejects.toThrow(
        'Answer not found',
      );
    });

    it('deletes answer', async () => {
      answerRepo.delete.mockResolvedValue(undefined);
      await expect(service.deleteAnswer(16)).resolves.toBeUndefined();
      expect(answerRepo.delete).toHaveBeenCalledWith(16);
    });
  });

  describe('getQuestionsByEvaluation', () => {
    it('returns questions with answers', async () => {
      const questions = [{ id: 17 }] as any;
      questionRepo.find.mockResolvedValue(questions);
      const res = await service.getQuestionsByEvaluation(20);
      expect(res).toBe(questions);
    });
  });
});
