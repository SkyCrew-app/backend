import { INestApplication } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule, Query, Resolver } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { User } from '../entity/users.entity';

@Resolver()
class ProbeResolver {
  @Query(() => User)
  probeUser(): Partial<User> {
    return {
      id: 1,
      first_name: 'Jean',
      last_name: 'Dupont',
      email: 'jean@example.com',
      password: '$2b$10$hash',
      twoFactorAuthSecret: 'ACTIVESECRET',
      twoFactorAuthPendingSecret: 'PENDINGSECRET',
      validation_token: 'validation-token',
    };
  }
}

// The User type is returned by many queries: credentials must never be
// readable through it.
describe('User type exposure', () => {
  let app: INestApplication;

  const query = async (selection: string) => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: `{ probeUser { ${selection} } }` });
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
      providers: [ProbeResolver],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns ordinary fields', async () => {
    const body = await query('id email first_name');

    expect(body.errors).toBeUndefined();
    expect(body.data.probeUser).toEqual({
      id: 1,
      email: 'jean@example.com',
      first_name: 'Jean',
    });
  });

  it('never returns the password hash or the validation token', async () => {
    const body = await query('password validation_token');

    expect(body.errors).toBeUndefined();
    expect(body.data.probeUser).toEqual({
      password: null,
      validation_token: null,
    });
  });

  it.each(['twoFactorAuthSecret', 'twoFactorAuthPendingSecret'])(
    'does not have %s in the schema',
    async (field) => {
      const body = await query(field);

      expect(body.data).toBeUndefined();
      expect(body.errors[0].message).toContain(`Cannot query field "${field}"`);
    },
  );
});
