import { DatabaseMetricsInterceptor } from './database.interceptor';
import { MetricsService } from '../../modules/metrics/metrics.service';
import { QueryRunner } from 'typeorm';

describe('DatabaseMetricsInterceptor', () => {
  let interceptor: DatabaseMetricsInterceptor;
  let metricsService: Partial<MetricsService>;
  let queryRunner: Partial<QueryRunner>;

  beforeEach(() => {
    jest.useFakeTimers();
    metricsService = {
      trackDatabaseQuery: jest.fn(),
      trackDatabaseQueryDuration: jest.fn(),
    };
    interceptor = new DatabaseMetricsInterceptor(
      metricsService as MetricsService,
    );
    queryRunner = { query: '' } as unknown as QueryRunner;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('devrait enregistrer le timestamp avant la requête', () => {
    const now = 123456;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    interceptor.beforeQuery(queryRunner as QueryRunner);

    // L'accès interne n'est pas exposé, mais on peut enchaîner avec afterQuery sans erreur
    expect(() =>
      interceptor.afterQuery(queryRunner as QueryRunner),
    ).not.toThrow();
  });

  it.each([
    ['SELECT * FROM table', 'SELECT'],
    ['INSERT INTO table VALUES ()', 'INSERT'],
    ['UPDATE table SET col=1', 'UPDATE'],
    ['DELETE FROM table', 'DELETE'],
    ['CREATE TABLE new', 'OTHER'],
  ])("devrait tracker l'opération %s comme %s", (sql, operation) => {
    // Simuler startTime et requête
    const startTime = 1000;
    jest.spyOn(Date, 'now').mockReturnValue(startTime);
    interceptor.beforeQuery(queryRunner as QueryRunner);

    // Ajuster la query dans le runner
    (queryRunner as any).query = sql;

    interceptor.afterQuery(queryRunner as QueryRunner);

    expect(metricsService.trackDatabaseQuery).toHaveBeenCalledWith(operation);
    expect(metricsService.trackDatabaseQueryDuration).toHaveBeenCalledWith(
      operation,
      startTime,
    );
  });

  it("n'appelle pas les métriques si aucun startTime", () => {
    // user après sans before
    expect(() =>
      interceptor.afterQuery(queryRunner as QueryRunner),
    ).not.toThrow();
    expect(metricsService.trackDatabaseQuery).not.toHaveBeenCalled();
    expect(metricsService.trackDatabaseQueryDuration).not.toHaveBeenCalled();
  });
});
