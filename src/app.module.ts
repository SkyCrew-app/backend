import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { typeOrmConfig } from './config/typeorm.config';
// import { RedisModule } from './config/redis.module';
import { MailerModule } from './modules/mail/mailer.module';
import { AppResolver } from './app.resolver';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { jwtConfig } from './config/jwt.config';
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
import { ExpensesModule } from './modules/expenses/expenses.module';
import { AuditModule } from './modules/audit/audit.module';
import { RolesModule } from './modules/roles/roles.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdministrationModule } from './modules/administration/administration.module';
import { GraphQLUpload } from 'graphql-upload-ts';
import { ArticleModule } from './modules/article/article.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { EvalModule } from './modules/eval/eval.module';
import { ELearningModule } from './modules/e-learning/e-learning.module';
import GraphQLJSON from 'graphql-type-json';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    //JWT Configuration
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: jwtConfig,
    }),

    // Configuration TypeORM
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: typeOrmConfig,
    }),

    // Configuration GraphQL
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: true,
      path: process.env.GRAPHQL_ENDPOINT || '/graphql',
      resolvers: { JSON: GraphQLJSON },
      context: ({ req, res }: { req: Request; res: Response }) => ({
        req,
        res,
      }),
    }),

    // Configuration Redis
    // RedisModule,

    // Mail Module
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

    ExpensesModule,

    AuditModule,

    RolesModule,

    AuthModule,

    AdministrationModule,

    ArticleModule,

    PaymentsModule,

    ELearningModule,

    EvalModule,
  ],
  providers: [
    AppResolver,
    {
      provide: 'Upload',
      useValue: GraphQLUpload,
    },
  ],
})
export class AppModule {}
