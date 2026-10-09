import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  Args,
  Field,
  GraphQLModule,
  InputType,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { IsEmail } from 'class-validator';
import * as request from 'supertest';
import { validationPipeOptions } from './validation.config';

// Most inputs of the application look like this one: no validation decorator.
@InputType()
class PlainInput {
  @Field()
  name: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => Date, { nullable: true })
  when?: Date;
}

@InputType()
class DecoratedInput {
  @Field()
  @IsEmail()
  email: string;
}

@Resolver()
class ProbeResolver {
  @Query(() => String)
  ping(): string {
    return 'pong';
  }

  @Mutation(() => String)
  savePlain(@Args('input') input: PlainInput): string {
    const when = input.when instanceof Date ? input.when.toISOString() : 'none';
    return `${input.name}:${input.quantity}:${when}`;
  }

  @Mutation(() => String)
  saveDecorated(@Args('input') input: DecoratedInput): string {
    return input.email;
  }
}

describe('global validation pipe', () => {
  let app: INestApplication;

  const run = async (query: string) =>
    (await request(app.getHttpServer()).post('/graphql').send({ query })).body;

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
    app.useGlobalPipes(new ValidationPipe(validationPipeOptions));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts an input that has no validation decorator', async () => {
    const body = await run(
      'mutation { savePlain(input: { name: "kit", quantity: 2 }) }',
    );

    expect(body.errors).toBeUndefined();
    expect(body.data.savePlain).toBe('kit:2:none');
  });

  it('still converts values to the declared types', async () => {
    const body = await run(
      'mutation { savePlain(input: { name: "kit", quantity: 2, when: "2026-11-01T08:00:00.000Z" }) }',
    );

    expect(body.data.savePlain).toBe('kit:2:2026-11-01T08:00:00.000Z');
  });

  it('still applies the rules of an input that declares some', async () => {
    const rejected = await run(
      'mutation { saveDecorated(input: { email: "not-an-email" }) }',
    );
    const accepted = await run(
      'mutation { saveDecorated(input: { email: "a@example.com" }) }',
    );

    expect(rejected.errors[0].extensions.code).toBe('BAD_REQUEST');
    expect(accepted.data.saveDecorated).toBe('a@example.com');
  });

  it('leaves unknown fields to the GraphQL schema', async () => {
    const body = await run(
      'mutation { savePlain(input: { name: "kit", quantity: 2, extra: true }) }',
    );

    expect(body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED');
  });
});
