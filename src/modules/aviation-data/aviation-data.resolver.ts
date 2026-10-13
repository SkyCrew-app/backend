import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { GqlThrottlerGuard } from '../../common/guards/gql-throttler.guard';
import { AviationDataService } from './aviation-data.service';
import {
  AerodromeByIataArgs,
  AerodromeByIcaoArgs,
  SearchAerodromesArgs,
  WeatherAtArgs,
} from './dto/aerodrome.args';
import { Aerodrome } from './entity/aerodrome.entity';
import { AerodromeWeather } from './entity/aerodrome-weather.entity';

// Open to every signed-in member (the global guard requires a session).
// Throttled because each call may spend the club's quota at the provider.
@Resolver()
@UseGuards(GqlThrottlerGuard)
export class AviationDataResolver {
  constructor(private readonly aviationDataService: AviationDataService) {}

  @Query(() => Aerodrome, { name: 'aerodromeByIcao', nullable: true })
  aerodromeByIcao(
    @Args() { icao }: AerodromeByIcaoArgs,
  ): Promise<Aerodrome | null> {
    return this.aviationDataService.aerodromeByIcao(icao);
  }

  @Query(() => Aerodrome, { name: 'aerodromeByIata', nullable: true })
  aerodromeByIata(
    @Args() { iata }: AerodromeByIataArgs,
  ): Promise<Aerodrome | null> {
    return this.aviationDataService.aerodromeByIata(iata);
  }

  @Query(() => [Aerodrome], { name: 'searchAerodromes' })
  searchAerodromes(
    @Args() { query }: SearchAerodromesArgs,
  ): Promise<Aerodrome[]> {
    return this.aviationDataService.searchAerodromes(query);
  }

  @Query(() => AerodromeWeather, { name: 'weatherAt', nullable: true })
  weatherAt(
    @Args() { latitude, longitude }: WeatherAtArgs,
  ): Promise<AerodromeWeather | null> {
    return this.aviationDataService.weatherAt(latitude, longitude);
  }
}
