import { Test, TestingModule } from '@nestjs/testing';
import {
  EvaluationResolver,
  QuestionResolver,
  AnswerResolver,
} from '../eval.resolver';
import { EvalService } from '../eval.service';

describe('Eval Resolvers', () => {
  let evalResolver: EvaluationResolver;
  let questionResolver: QuestionResolver;
  let answerResolver: AnswerResolver;
  let service: any;

  beforeEach(async () => {
    service = {
      getAllEvaluations: jest.fn(),
      getEvaluationById: jest.fn(),
      createEvaluation: jest.fn(),
      updateEvaluation: jest.fn(),
      deleteEvaluation: jest.fn(),
      getEvaluationsByModule: jest.fn(),
      getQuestionsByEvaluation: jest.fn(),
      createQuestion: jest.fn(),
      updateQuestion: jest.fn(),
      deleteQuestion: jest.fn(),
      createAnswer: jest.fn(),
      updateAnswer: jest.fn(),
      deleteAnswer: jest.fn(),
      validateAnswers: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationResolver,
        QuestionResolver,
        AnswerResolver,
        { provide: EvalService, useValue: service },
      ],
    }).compile();

    evalResolver = moduleRef.get<EvaluationResolver>(EvaluationResolver);
    questionResolver = moduleRef.get<QuestionResolver>(QuestionResolver);
    answerResolver = moduleRef.get<AnswerResolver>(AnswerResolver);
  });

  it('getEvaluations calls service', async () => {
    service.getAllEvaluations.mockResolvedValue([]);
    expect(await evalResolver.getEvaluations()).toEqual([]);
    expect(service.getAllEvaluations).toHaveBeenCalled();
  });

  it('getEvaluationById calls service', async () => {
    service.getEvaluationById.mockResolvedValue({ id: 1 });
    expect(await evalResolver.getEvaluationById(1)).toEqual({ id: 1 });
  });

  it('createEvaluation calls service', async () => {
    const dto = { moduleId: 1, pass_score: 50 };
    service.createEvaluation.mockResolvedValue({ id: 10 });
    expect(await evalResolver.createEvaluation(dto)).toEqual({ id: 10 });
  });

  it('updateEvaluation calls service', async () => {
    service.updateEvaluation.mockResolvedValue({ id: 2 });
    expect(await evalResolver.updateEvaluation(2, {})).toEqual({ id: 2 });
  });

  it('deleteEvaluation calls service', async () => {
    service.deleteEvaluation.mockResolvedValue(undefined);
    expect(await evalResolver.deleteEvaluation(3)).toBe(true);
    expect(service.deleteEvaluation).toHaveBeenCalledWith(3);
  });

  it('getEvaluationsByModule calls service', async () => {
    service.getEvaluationsByModule.mockResolvedValue([{ id: 5 }]);
    expect(await evalResolver.getEvaluationsByModule(5)).toEqual([{ id: 5 }]);
  });

  it('getQuestionsByEvaluation calls service', async () => {
    service.getQuestionsByEvaluation.mockResolvedValue([{ id: 20 }]);
    expect(await questionResolver.getQuestionsByEvaluation(5)).toEqual([
      { id: 20 },
    ]);
  });

  it('createQuestion calls service', async () => {
    service.createQuestion.mockResolvedValue({ id: 21 });
    expect(
      await questionResolver.createQuestion(1, {
        content: {},
        options: ['A'],
        correct_answer: 'A',
      }),
    ).toEqual({ id: 21 });
  });

  it('updateQuestion calls service', async () => {
    service.updateQuestion.mockResolvedValue({ id: 22 });
    expect(
      await questionResolver.updateQuestion(22, { options: ['B'] }),
    ).toEqual({ id: 22 });
  });

  it('deleteQuestion calls service', async () => {
    service.deleteQuestion.mockResolvedValue(undefined);
    expect(await questionResolver.deleteQuestion(23)).toBe(true);
  });

  it('createAnswer calls service', async () => {
    service.createAnswer.mockResolvedValue({ id: 30 });
    expect(
      await answerResolver.createAnswer(1, 2, {
        answer_text: 'A',
        is_correct: true,
        questionId: 0,
      }),
    ).toEqual({ id: 30 });
  });

  it('updateAnswer calls service', async () => {
    service.updateAnswer.mockResolvedValue({ id: 31 });
    expect(await answerResolver.updateAnswer(31, { answer_text: 'B' })).toEqual(
      { id: 31 },
    );
  });

  it('deleteAnswer calls service', async () => {
    service.deleteAnswer.mockResolvedValue(undefined);
    expect(await answerResolver.deleteAnswer(32)).toBe(true);
  });

  it('validateAnswers calls service', async () => {
    service.validateAnswers.mockResolvedValue({ score: 100, passed: true });
    expect(await answerResolver.validateAnswers(1, 2, [])).toEqual({
      score: 100,
      passed: true,
    });
  });
});
