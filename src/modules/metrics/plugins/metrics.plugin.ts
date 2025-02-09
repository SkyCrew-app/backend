import { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';
import { Plugin } from '@nestjs/apollo';
import { Injectable } from '@nestjs/common';
import { MetricsService } from '../metrics.service';

@Injectable()
@Plugin()
export class GraphQLMetricsPlugin implements ApolloServerPlugin {
  constructor(private readonly metricsService: MetricsService) {}

  async requestDidStart(): Promise<GraphQLRequestListener<any>> {
    const startTime = Date.now();
    const metricsService = this.metricsService;

    return {
      async willSendResponse(requestContext) {
        const operationType = requestContext.operation?.operation || 'unknown';
        const operationName =
          requestContext.operation?.name?.value || 'anonymous';

        metricsService.trackGraphQLOperation(
          operationType as 'query' | 'mutation',
          operationName,
        );
        metricsService.trackResolverDuration(operationName, startTime);
      },

      async didEncounterErrors(requestContext) {
        const operationName =
          requestContext.operation?.name?.value || 'anonymous';

        requestContext.errors.forEach((error) => {
          metricsService.trackGraphQLError(
            (error.extensions?.code as string) || 'UNKNOWN_ERROR',
            operationName,
          );
        });
      },
    };
  }
}
