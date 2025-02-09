import { Injectable } from '@nestjs/common';
import { MetricsService } from '../../modules/metrics/metrics.service';
import { QueryRunner } from 'typeorm';

@Injectable()
export class DatabaseMetricsInterceptor {
  private readonly queryStartTimes = new WeakMap<QueryRunner, number>();

  constructor(private readonly metricsService: MetricsService) {}

  beforeQuery(queryRunner: QueryRunner) {
    this.queryStartTimes.set(queryRunner, Date.now());
  }

  afterQuery(queryRunner: QueryRunner) {
    const startTime = this.queryStartTimes.get(queryRunner);
    if (startTime) {
      const query = queryRunner.query.toString();
      const operation = this.getOperationType(query);

      this.metricsService.trackDatabaseQuery(operation);
      this.metricsService.trackDatabaseQueryDuration(operation, startTime);

      this.queryStartTimes.delete(queryRunner);
    }
  }

  private getOperationType(query: string): string {
    if (query.startsWith('SELECT')) return 'SELECT';
    if (query.startsWith('INSERT')) return 'INSERT';
    if (query.startsWith('UPDATE')) return 'UPDATE';
    if (query.startsWith('DELETE')) return 'DELETE';
    return 'OTHER';
  }
}
