import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('PROM_METRIC_GRAPHQL_OPERATIONS_TOTAL')
    private readonly graphqlOperations: Counter<string>,
    @InjectMetric('PROM_METRIC_GRAPHQL_RESOLVER_DURATION_SECONDS')
    private readonly resolverDuration: Histogram<string>,
    @InjectMetric('PROM_METRIC_GRAPHQL_ERRORS_TOTAL')
    private readonly graphqlErrors: Counter<string>,
    @InjectMetric('PROM_METRIC_HTTP_REQUESTS_TOTAL')
    private readonly httpRequests: Counter<string>,
    @InjectMetric('PROM_METRIC_HTTP_REQUEST_DURATION_SECONDS')
    private readonly httpDuration: Histogram<string>,
    @InjectMetric('PROM_METRIC_MEMORY_USAGE_BYTES')
    private readonly memoryUsage: Gauge<string>,
    @InjectMetric('PROM_METRIC_CPU_USAGE_PERCENT')
    private readonly cpuUsage: Gauge<string>,
    @InjectMetric('PROM_METRIC_ACTIVE_USERS')
    private readonly activeUsers: Gauge<string>,
    @InjectMetric('PROM_METRIC_DATABASE_QUERIES_TOTAL')
    private readonly dbQueries: Counter<string>,
    @InjectMetric('PROM_METRIC_DATABASE_QUERY_DURATION_SECONDS')
    private readonly dbQueryDuration: Histogram<string>,
  ) {
    setInterval(this.updateSystemMetrics.bind(this), 15000);
  }

  // GraphQL Metrics
  trackGraphQLOperation(operationType: 'query' | 'mutation', name: string) {
    this.graphqlOperations.inc({
      operation_type: operationType,
      operation_name: name,
    });
  }

  trackResolverDuration(resolverName: string, startTime: number) {
    const duration = (Date.now() - startTime) / 1000;
    this.resolverDuration.observe({ resolver: resolverName }, duration);
  }

  trackGraphQLError(errorType: string, operationName: string) {
    this.graphqlErrors.inc({
      error_type: errorType,
      operation_name: operationName,
    });
  }

  // HTTP Metrics
  trackHttpRequest(method: string, path: string, statusCode: number) {
    this.httpRequests.inc({ method, path, status_code: statusCode });
  }

  startHttpRequest(): number {
    return Date.now();
  }

  endHttpRequest(startTime: number, method: string, path: string) {
    const duration = (Date.now() - startTime) / 1000;
    this.httpDuration.observe({ method, path }, duration);
  }

  // Database Metrics
  trackDatabaseQuery(operation: string) {
    this.dbQueries.inc({ operation });
  }

  trackDatabaseQueryDuration(operation: string, startTime: number) {
    const duration = (Date.now() - startTime) / 1000;
    this.dbQueryDuration.observe({ operation }, duration);
  }

  // Business Metrics
  setActiveUsers(count: number) {
    this.activeUsers.set(count);
  }

  private async updateSystemMetrics() {
    // Memory usage
    const used = process.memoryUsage();
    this.memoryUsage.set({ type: 'heapTotal' }, used.heapTotal);
    this.memoryUsage.set({ type: 'heapUsed' }, used.heapUsed);
    this.memoryUsage.set({ type: 'rss' }, used.rss);

    // CPU usage (simplified)
    const startUsage = process.cpuUsage();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const endUsage = process.cpuUsage(startUsage);
    const totalUsage = (endUsage.user + endUsage.system) / 1000000;
    this.cpuUsage.set(totalUsage);
  }
}
