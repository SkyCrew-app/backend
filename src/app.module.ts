import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

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
        playground: true,
        path: process.env.GRAPHQL_ENDPOINT || '/graphql',
        resolvers: { JSON: GraphQLJSON },
        plugins: [metricsPlugin],
        context: ({ req, res }: { req: Request; res: Response }) => ({
          req,
          res,
        }),
      }),
    }),

    MailerModule,

    UsersModule,

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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
