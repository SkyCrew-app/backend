import { UserProgressResolver } from '../users.resolver';
import { UsersService } from '../users.service';
import { EvalService } from '../../eval/eval.service';

describe('UserProgressResolver', () => {
  let resolver: UserProgressResolver;
  let usersService: Partial<UsersService>;
  let evalService: Partial<EvalService>;

  beforeEach(() => {
    usersService = {
      getCourseProgress: jest.fn(),
      markLessonStarted: jest.fn(),
      markLessonCompleted: jest.fn(),
      getEvaluationResults: jest.fn(),
      getUserProgress: jest.fn(),
    };
    evalService = {
      getUserEvaluationResults: jest.fn(),
    };
    resolver = new UserProgressResolver(
      evalService as EvalService,
      usersService as UsersService,
    );
  });

  it('getUserProgressByEvaluation devrait renvoyer les résultats des évaluations de utilisateur via EvalService', async () => {
    const evalResults = [{ id: 1 }, { id: 2 }];
    (evalService.getUserEvaluationResults as jest.Mock).mockResolvedValue(
      evalResults,
    );

    const result = await resolver.getUserProgressByEvaluation(5);

    expect(evalService.getUserEvaluationResults).toHaveBeenCalledWith(5);
    expect(result).toBe(evalResults);
  });

  it('getCourseProgress devrait renvoyer le pourcentage de progression via UsersService.getCourseProgress', async () => {
    (usersService.getCourseProgress as jest.Mock).mockResolvedValue(50);

    const result = await resolver.getCourseProgress(2, 100);

    expect(usersService.getCourseProgress).toHaveBeenCalledWith(2, 100);
    expect(result).toBe(50);
  });

  it('markLessonStarted devrait appeler UsersService.markLessonStarted et retourner true', async () => {
    (usersService.markLessonStarted as jest.Mock).mockResolvedValue(undefined);

    const result = await resolver.markLessonStarted(1, 10);

    expect(usersService.markLessonStarted).toHaveBeenCalledWith(1, 10);
    expect(result).toBe(true);
  });

  it('markLessonCompleted devrait appeler UsersService.markLessonCompleted et retourner true', async () => {
    (usersService.markLessonCompleted as jest.Mock).mockResolvedValue(
      undefined,
    );

    const result = await resolver.markLessonCompleted(1, 10);

    expect(usersService.markLessonCompleted).toHaveBeenCalledWith(1, 10);
    expect(result).toBe(true);
  });

  it('getUserEvaluationResults devrait renvoyer la liste des UserProgress via UsersService.getEvaluationResults', async () => {
    const progressList = [{ id: 11 }, { id: 12 }];
    (usersService.getEvaluationResults as jest.Mock).mockResolvedValue(
      progressList,
    );

    const result = await resolver.getUserEvaluationResults(7);

    expect(usersService.getEvaluationResults).toHaveBeenCalledWith(7);
    expect(result).toBe(progressList);
  });

  it('getUserProgress devrait indiquer si la leçon est complétée via UsersService.getUserProgress', async () => {
    (usersService.getUserProgress as jest.Mock).mockResolvedValue(true);

    const result = await resolver.getUserProgress(3, 8);

    expect(usersService.getUserProgress).toHaveBeenCalledWith(3, 8);
    expect(result).toBe(true);
  });
});
