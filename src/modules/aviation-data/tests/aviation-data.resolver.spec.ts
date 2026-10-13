import { Test } from '@nestjs/testing';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { printSchema } from 'graphql';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { GqlThrottlerGuard } from '../../../common/guards/gql-throttler.guard';
import { AviationDataResolver } from '../aviation-data.resolver';
import { AviationDataService } from '../aviation-data.service';

describe('AviationDataResolver', () => {
  const service = {
    aerodromeByIcao: jest.fn(),
    aerodromeByIata: jest.fn(),
    searchAerodromes: jest.fn(),
    weatherAt: jest.fn(),
  };
  const resolver = new AviationDataResolver(
    service as unknown as AviationDataService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('hands each query to the service', async () => {
    service.aerodromeByIcao.mockResolvedValue({ name: 'A' });
    service.aerodromeByIata.mockResolvedValue(null);
    service.searchAerodromes.mockResolvedValue([]);
    service.weatherAt.mockResolvedValue({ temperature: 12 });

    await expect(resolver.aerodromeByIcao({ icao: 'LFPG' })).resolves.toEqual({
      name: 'A',
    });
    await expect(resolver.aerodromeByIata({ iata: 'CDG' })).resolves.toBeNull();
    await expect(
      resolver.searchAerodromes({ query: 'paris' }),
    ).resolves.toEqual([]);
    await expect(
      resolver.weatherAt({ latitude: 49, longitude: 2.5 }),
    ).resolves.toEqual({ temperature: 12 });

    expect(service.aerodromeByIcao).toHaveBeenCalledWith('LFPG');
    expect(service.aerodromeByIata).toHaveBeenCalledWith('CDG');
    expect(service.searchAerodromes).toHaveBeenCalledWith('paris');
    expect(service.weatherAt).toHaveBeenCalledWith(49, 2.5);
  });

  it('is not public and is throttled', () => {
    const queries = [
      'aerodromeByIcao',
      'aerodromeByIata',
      'searchAerodromes',
      'weatherAt',
    ] as const;

    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, AviationDataResolver),
    ).toBeUndefined();
    for (const query of queries) {
      expect(
        Reflect.getMetadata(
          IS_PUBLIC_KEY,
          AviationDataResolver.prototype[query],
        ),
      ).toBeUndefined();
    }
    expect(Reflect.getMetadata('__guards__', AviationDataResolver)).toEqual([
      GqlThrottlerGuard,
    ]);
  });

  it('exposes the four queries in the schema', async () => {
    const module = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule],
    }).compile();
    const schema = await module
      .get(GraphQLSchemaFactory)
      .create([AviationDataResolver]);
    const sdl = printSchema(schema);

    expect(sdl).toContain('aerodromeByIcao(icao: String!): Aerodrome');
    expect(sdl).toContain('aerodromeByIata(iata: String!): Aerodrome');
    expect(sdl).toContain('searchAerodromes(');
    expect(sdl).toContain('): [Aerodrome!]!');
    expect(sdl).toContain(
      'weatherAt(latitude: Float!, longitude: Float!): AerodromeWeather',
    );
  });
});
