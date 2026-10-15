import { INestApplication, UseFilters } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule, Query, Resolver } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { LocalizedExceptionFilter } from '../../i18n/localized-exception.filter';
import { PlanFeature, PlanName } from '../plan';
import { PlanService } from '../plan.service';
import { PlanFeatureGuard, RequiresPlanFeature } from '../plan-feature.guard';

@Resolver()
@UseFilters(LocalizedExceptionFilter)
class ProbeResolver {
  @Query(() => String)
  @RequiresPlanFeature(PlanFeature.INSTRUCTION)
  lessons(): string {
    return 'lessons';
  }

  @Query(() => String)
  fleet(): string {
    return 'fleet';
  }
}

// The refusal comes from a global guard: it must still reach the member as
// a readable message, in their language.
describe('A refusal of the plan, through GraphQL', () => {
  let app: INestApplication;

  const query = async (field: string, language?: string) => {
    const call = request(app.getHttpServer()).post('/graphql');
    if (language) call.set('Accept-Language', language);
    return (await call.send({ query: `{ ${field} }` })).body;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
        }),
      ],
      providers: [
        ProbeResolver,
        {
          provide: PlanService,
          useValue: PlanService.of({ plan: PlanName.CLUB }),
        },
        { provide: APP_GUARD, useClass: PlanFeatureGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses an instruction operation in French by default', async () => {
    const body = await query('lessons');

    expect(body.data).toBeNull();
    expect(body.errors[0].message).toMatch(/formule Club \+ École/);
    expect(body.errors[0].extensions.code).toBe('FORBIDDEN');
  });

  it('refuses it in English when the interface is in English', async () => {
    const body = await query('lessons', 'en');

    expect(body.errors[0].message).toMatch(/Club \+ School plan/);
  });

  it('lets every other operation through', async () => {
    expect((await query('fleet')).data).toEqual({ fleet: 'fleet' });
  });
});
