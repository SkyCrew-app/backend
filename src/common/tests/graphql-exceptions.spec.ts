import {
  CanActivate,
  INestApplication,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule, Query, Resolver } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

@Injectable()
class DenyGuard implements CanActivate {
  canActivate(): boolean {
    throw new UnauthorizedException();
  }
}

@Resolver()
class ProbeResolver {
  @Query(() => String)
  available(): string {
    return 'ok';
  }

  @Query(() => String)
  missing(): string {
    throw new NotFoundException('Aircraft not found');
  }

  @Query(() => String)
  @UseGuards(DenyGuard)
  restricted(): string {
    return 'secret';
  }
}

// Guards against mismatched @nestjs/* major versions, which made every
// exception thrown by a resolver surface as an opaque internal error.
describe('GraphQL exception handling', () => {
  let app: INestApplication;

  const query = async (field: string) => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: `{ ${field} }` });
    return response.body;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
        }),
      ],
      providers: [ProbeResolver, DenyGuard],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('resolves a query that does not throw', async () => {
    const body = await query('available');

    expect(body.errors).toBeUndefined();
    expect(body.data).toEqual({ available: 'ok' });
  });

  it('returns the message of an exception thrown by a resolver', async () => {
    const body = await query('missing');

    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].message).toBe('Aircraft not found');
  });

  it('reports a rejected guard as unauthenticated', async () => {
    const body = await query('restricted');

    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].message).toBe('Unauthorized');
    expect(body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });
});
