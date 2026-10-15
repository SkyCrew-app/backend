import { INestApplication, UseFilters } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { LocalizedExceptionFilter } from '../../i18n/localized-exception.filter';
import { SuspensionGuard } from '../suspension.guard';
import { SuspensionResolver } from '../suspension.resolver';
import { SuspensionService } from '../suspension.service';

@Resolver()
@UseFilters(LocalizedExceptionFilter)
class ProbeResolver {
  @Query(() => String)
  fleet(): string {
    return 'fleet';
  }

  @Mutation(() => String)
  bookAircraft(): string {
    return 'booked';
  }

  @Mutation(() => Boolean)
  logout(): boolean {
    return true;
  }
}

const appWith = async (suspended: boolean): Promise<INestApplication> => {
  const moduleRef = await Test.createTestingModule({
    imports: [
      GraphQLModule.forRoot<ApolloDriverConfig>({
        driver: ApolloDriver,
        autoSchemaFile: true,
      }),
    ],
    providers: [
      ProbeResolver,
      SuspensionResolver,
      { provide: SuspensionService, useValue: SuspensionService.of(suspended) },
      { provide: APP_GUARD, useClass: SuspensionGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
};

const send = async (
  app: INestApplication,
  query: string,
  language?: string,
) => {
  const call = request(app.getHttpServer()).post('/graphql');
  if (language) call.set('Accept-Language', language);
  return (await call.send({ query })).body;
};

describe('A suspended installation, through GraphQL', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await appWith(true);
  });

  afterAll(async () => {
    await app.close();
  });

  it('says it is suspended', async () => {
    expect((await send(app, '{ serviceSuspended }')).data).toEqual({
      serviceSuspended: true,
    });
  });

  it('refuses every change, in French by default', async () => {
    const body = await send(app, 'mutation { bookAircraft }');

    expect(body.data).toBeNull();
    expect(body.errors[0].message).toMatch(/est suspendu/);
    expect(body.errors[0].extensions.code).toBe('FORBIDDEN');
  });

  it('refuses it in English when the interface is in English', async () => {
    const body = await send(app, 'mutation { bookAircraft }', 'en');

    expect(body.errors[0].message).toMatch(/is suspended/);
  });

  it('still lets members read and sign out', async () => {
    expect((await send(app, '{ fleet }')).data).toEqual({ fleet: 'fleet' });
    expect((await send(app, 'mutation { logout }')).data).toEqual({
      logout: true,
    });
  });
});

describe('An installation that is not suspended', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await appWith(false);
  });

  afterAll(async () => {
    await app.close();
  });

  it('says so and accepts changes', async () => {
    expect((await send(app, '{ serviceSuspended }')).data).toEqual({
      serviceSuspended: false,
    });
    expect((await send(app, 'mutation { bookAircraft }')).data).toEqual({
      bookAircraft: 'booked',
    });
  });
});
