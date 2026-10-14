import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { withHttpErrorCode } from './common/graphql/error-codes';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ThrottlerModule } from '@nestjs/throttler';
import { typeOrmConfig } from './config/typeorm.config';
import { MailerModule } from './modules/mail/mailer.module';
import { AppResolver } from './app.resolver';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { jwtConfig } from './config/jwt.config';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { UsersModule } from './modules/users/users.module';
import { AircraftModule } from './modules/aircraft/aircraft.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { LicensesModule } from './modules/licenses/licenses.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FlightsModule } from './modules/flights/flights.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { InstructionCoursesModule } from './modules/instruction-courses/instruction-courses.module';
import { AuditModule } from './modules/audit/audit.module';
import { RolesModule } from './modules/roles/roles.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdministrationModule } from './modules/administration/administration.module';
import { GraphQLUpload } from 'graphql-upload-ts';
import { queryLimitsRule } from './common/graphql/query-limits.rule';
import { ArticleModule } from './modules/article/article.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { EvalModule } from './modules/eval/eval.module';
import { ELearningModule } from './modules/e-learning/e-learning.module';
import { CronService } from './modules/cron/cron.service';
import GraphQLJSON from 'graphql-type-json';
import { ScheduleModule } from '@nestjs/schedule';
import { MetricsService } from './modules/metrics/metrics.service';
import { MetricsMiddleware } from './modules/metrics/metrics.middleware';
import { MetricsModule } from './modules/metrics/metrics.module';
import { GraphQLMetricsPlugin } from './modules/metrics/plugins/metrics.plugin';
import { DatabaseMetricsInterceptor } from './common/interceptors/database.interceptor';
import { FinancialModule } from './modules/financial/financial.module';
import { HealthModule } from './modules/health/health.module';
import { ChecklistsModule } from './modules/checklists/checklists.module';
import { AviationDataModule } from './modules/aviation-data/aviation-data.module';
import { APP_GUARD } from '@nestjs/core';
import { DemoModeGuard } from './common/guards/demo-mode.guard';
import { AuthenticatedByDefaultGuard } from './common/guards/authenticated-by-default.guard';
import { AdminActionsModule } from './common/admin-actions/admin-actions.module';
import { MemberDepartureModule } from './modules/users/member-departure.module';
import { PlanModule } from './common/plan/plan.module';
import { PlanFeatureGuard } from './common/plan/plan-feature.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 50,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 200,
      },
    ]),

    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: jwtConfig,
    }),

    MetricsModule,

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, MetricsModule],
      inject: [ConfigService, MetricsService],
      useFactory: (
        configService: ConfigService,
        metricsService: MetricsService,
      ) => {
        const config = typeOrmConfig(configService);
        const interceptor = new DatabaseMetricsInterceptor(metricsService);

        return {
          ...config,
          logging: false,
          logger: 'advanced-console',
          subscribers: [],
          entityEventSubscribers: [],
          beforeQueryExecution: (event) =>
            interceptor.beforeQuery(event.queryRunner),
          afterQueryExecution: (event) =>
            interceptor.afterQuery(event.queryRunner),
        };
      },
    }),

    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [MetricsModule],
      inject: [MetricsService, GraphQLMetricsPlugin],
      useFactory: (
        metricsService: MetricsService,
        metricsPlugin: GraphQLMetricsPlugin,
      ) => ({
        autoSchemaFile: true,
        // The query explorer is a development tool: not served in production.
        playground: process.env.NODE_ENV !== 'production',
        path: process.env.GRAPHQL_ENDPOINT || '/graphql',
        resolvers: { JSON: GraphQLJSON },
        plugins: [metricsPlugin],
        formatError: withHttpErrorCode,
        validationRules: [
          queryLimitsRule({
            // Only the development explorer reads the schema.
            ignoreIntrospection: process.env.NODE_ENV !== 'production',
          }),
        ],
        context: ({ req, res }: { req: Request; res: Response }) => ({
          req,
          res,
        }),
      }),
    }),

    PlanModule,

    MailerModule,

    AdminActionsModule,

    UsersModule,

    MemberDepartureModule,

    AircraftModule,

    ReservationsModule,

    MaintenanceModule,

    LicensesModule,

    InvoicesModule,

    NotificationsModule,

    FlightsModule,

    IncidentsModule,

    InstructionCoursesModule,

    AuditModule,

    RolesModule,

    AuthModule,

    AdministrationModule,

    ArticleModule,

    PaymentsModule,

    ELearningModule,

    EvalModule,

    FinancialModule,

    HealthModule,

    ChecklistsModule,

    AviationDataModule,

    AuditModule,

    ScheduleModule.forRoot(),

    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT || 6379,
      ttl: 2592000,
      keyPrefix: '',
      db: 0,
    }),
  ],
  providers: [
    AppResolver,
    {
      provide: 'Upload',
      useValue: GraphQLUpload,
    },
    CronService,
    GraphQLMetricsPlugin,
    // Order matters: authenticate first, then apply the demo restrictions.
    {
      provide: APP_GUARD,
      useClass: AuthenticatedByDefaultGuard,
    },
    {
      provide: APP_GUARD,
      useClass: DemoModeGuard,
    },
    // Then refuse what the plan of the installation does not include.
    {
      provide: APP_GUARD,
      useClass: PlanFeatureGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
