import {
  ConflictException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  UseFilters,
} from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule, Query, Resolver } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { Language } from '../languages';
import { localized, translationOf } from '../localized-exception';
import { LocalizedExceptionFilter } from '../localized-exception.filter';
import { languageOfRequest, RequestLanguage } from '../request-language';

// Stands for the session: the stored language of the signed-in member.
let storedLanguage: string | null = null;

@Resolver()
@UseFilters(LocalizedExceptionFilter)
class ProbeResolver {
  @Query(() => String)
  refused(): string {
    throw localized(ConflictException, 'error.flight.alreadyClosed');
  }

  @Query(() => String)
  refusedWithParameters(): string {
    throw localized(NotFoundException, 'error.reservation.aircraftNotFound', {
      aircraftId: 12,
    });
  }

  @Query(() => String)
  forbidden(): string {
    throw localized(ForbiddenException, 'error.payment.notOwnPayment');
  }

  @Query(() => String)
  internal(): string {
    throw new NotFoundException('Aircraft not found');
  }

  @Query(() => String)
  language(@RequestLanguage() language: Language): string {
    return language;
  }
}

// The same exceptions, on a resolver that does not translate them.
@Resolver()
class PlainResolver {
  @Query(() => String)
  plainRefused(): string {
    throw new ConflictException('Ce vol est déjà clôturé');
  }

  @Query(() => String)
  plainForbidden(): string {
    throw new ForbiddenException(
      'Vous ne pouvez confirmer que vos propres paiements',
    );
  }

  @Query(() => String)
  plainInternal(): string {
    throw new NotFoundException('Aircraft not found');
  }
}

describe('localized refusals', () => {
  let app: INestApplication;

  const query = async (field: string, acceptLanguage?: string) => {
    const call = request(app.getHttpServer()).post('/graphql');
    if (acceptLanguage) {
      call.set('Accept-Language', acceptLanguage);
    }
    const response = await call.send({ query: `{ ${field} }` });
    return response.body;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          context: ({ req }) => {
            req.user = storedLanguage
              ? { language: storedLanguage }
              : undefined;
            return { req };
          },
        }),
      ],
      providers: [ProbeResolver, PlainResolver],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    storedLanguage = null;
  });

  // Everything but the path must be what the API answered before.
  const withoutPath = (body: any) =>
    body.errors.map(({ message, extensions }) => ({ message, extensions }));

  it('answers in French by default, exactly as an untranslated exception', async () => {
    const body = await query('refused');

    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].message).toBe('Ce vol est déjà clôturé');
    expect(body.data).toBeNull();
    expect(withoutPath(body)).toEqual(withoutPath(await query('plainRefused')));
    expect(withoutPath(await query('forbidden'))).toEqual(
      withoutPath(await query('plainForbidden')),
    );
  });

  it('answers in the language of the interface', async () => {
    const french = await query('refused', 'fr');
    const english = await query('refused', 'en');

    expect(french.errors[0].message).toBe('Ce vol est déjà clôturé');
    expect(english.errors).toHaveLength(1);
    expect(english.errors[0].message).toBe('This flight is already closed');
    expect(english.errors[0].extensions.code).toBe(
      french.errors[0].extensions.code,
    );
    expect(english.errors[0].extensions.status).toBe(409);
  });

  it('keeps the error code of the exception', async () => {
    const body = await query('forbidden', 'en');

    expect(body.errors[0].message).toBe(
      'You can only confirm your own payments',
    );
    expect(body.errors[0].extensions.code).toBe('FORBIDDEN');
  });

  it('keeps the parameters of the message', async () => {
    const body = await query('refusedWithParameters', 'en-GB,en;q=0.9');

    expect(body.errors[0].message).toBe(
      'The aircraft with ID 12 does not exist.',
    );
    expect(body.errors[0].extensions.status).toBe(404);
  });

  it("falls back to the member's stored language, then to French", async () => {
    storedLanguage = 'en';
    expect((await query('refused')).errors[0].message).toBe(
      'This flight is already closed',
    );
    expect((await query('refused', 'de')).errors[0].message).toBe(
      'This flight is already closed',
    );
    // The interface wins over the stored language.
    expect((await query('refused', 'fr')).errors[0].message).toBe(
      'Ce vol est déjà clôturé',
    );
  });

  it('leaves the other exceptions as they are', async () => {
    const body = await query('internal', 'en');

    expect(body.errors[0].message).toBe('Aircraft not found');
    expect(withoutPath(body)).toEqual(
      withoutPath(await query('plainInternal', 'en')),
    );
  });

  it('gives resolvers the language of the request', async () => {
    expect((await query('language')).data.language).toBe('fr');
    expect((await query('language', 'en')).data.language).toBe('en');
  });

  it('throws the exception it was asked for, in French', () => {
    const exception = localized(
      ConflictException,
      'error.flight.alreadyClosed',
    );

    expect(exception).toBeInstanceOf(ConflictException);
    expect(exception.message).toBe('Ce vol est déjà clôturé');
    expect(translationOf(exception)).toEqual({
      key: 'error.flight.alreadyClosed',
      params: undefined,
    });
    expect(translationOf(new ConflictException('x'))).toBeNull();
  });

  it('reads the language of a request without a header or a session', () => {
    expect(languageOfRequest(undefined)).toBe('fr');
    expect(languageOfRequest({ headers: {} })).toBe('fr');
    expect(
      languageOfRequest({ headers: { 'accept-language': ['de', 'en'] } }),
    ).toBe('en');
  });
});
