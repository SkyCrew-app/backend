import { Module } from '@nestjs/common';
import {
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
  PrometheusModule,
} from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';
import { GraphQLMetricsPlugin } from './plugins/metrics.plugin';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: false,
        config: {
          prefix: 'nestjs_',
        },
      },
    }),
  ],
  providers: [
    MetricsService,

    GraphQLMetricsPlugin,
    // GraphQL Metrics
    makeCounterProvider({
      name: 'PROM_METRIC_GRAPHQL_OPERATIONS_TOTAL',
      help: 'Total number of GraphQL operations',
      labelNames: ['operation_type', 'operation_name'],
    }),
    makeHistogramProvider({
      name: 'PROM_METRIC_GRAPHQL_RESOLVER_DURATION_SECONDS',
      help: 'Duration of GraphQL resolvers',
      labelNames: ['resolver'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 2, 5],
    }),
    makeCounterProvider({
      name: 'PROM_METRIC_GRAPHQL_ERRORS_TOTAL',
      help: 'Total number of GraphQL errors',
      labelNames: ['error_type', 'operation_name'],
    }),

    // HTTP Metrics
    makeCounterProvider({
      name: 'PROM_METRIC_HTTP_REQUESTS_TOTAL',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status_code'],
    }),
    makeHistogramProvider({
      name: 'PROM_METRIC_HTTP_REQUEST_DURATION_SECONDS',
      help: 'Duration of HTTP requests',
      labelNames: ['method', 'path'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 2, 5],
    }),

    // Performance Metrics
    makeGaugeProvider({
      name: 'PROM_METRIC_MEMORY_USAGE_BYTES',
      help: 'Memory usage in bytes',
      labelNames: ['type'],
    }),
    makeGaugeProvider({
      name: 'PROM_METRIC_CPU_USAGE_PERCENT',
      help: 'CPU usage percentage',
    }),

    // Business Metrics
    makeGaugeProvider({
      name: 'PROM_METRIC_ACTIVE_USERS',
      help: 'Number of currently active users',
    }),
    makeCounterProvider({
      name: 'PROM_METRIC_DATABASE_QUERIES_TOTAL',
      help: 'Total number of database queries',
      labelNames: ['operation'],
    }),
    makeHistogramProvider({
      name: 'PROM_METRIC_DATABASE_QUERY_DURATION_SECONDS',
      help: 'Duration of database queries',
      labelNames: ['operation'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 2, 5],
    }),
  ],
  exports: [MetricsService, GraphQLMetricsPlugin],
})
export class MetricsModule {}
