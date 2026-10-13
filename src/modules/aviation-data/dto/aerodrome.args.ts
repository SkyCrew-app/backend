import { ArgsType, Field, Float } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsString,
  Length,
  Matches,
} from 'class-validator';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

@ArgsType()
export class AerodromeByIcaoArgs {
  @Field()
  @Transform(trimmed)
  @IsString()
  @Matches(/^[A-Za-z]{4}$/, { message: 'icao must be 4 letters' })
  icao: string;
}

@ArgsType()
export class AerodromeByIataArgs {
  @Field()
  @Transform(trimmed)
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, { message: 'iata must be 3 letters' })
  iata: string;
}

@ArgsType()
export class SearchAerodromesArgs {
  @Field({ description: 'ICAO code, IATA code or part of the name' })
  @Transform(trimmed)
  @IsString()
  @Length(2, 50)
  // Letters of any alphabet, digits and the punctuation found in names.
  @Matches(/^[\p{L}\p{N} .'’-]+$/u, {
    message: 'query contains unsupported characters',
  })
  query: string;
}

@ArgsType()
export class WeatherAtArgs {
  @Field(() => Float)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsLatitude()
  latitude: number;

  @Field(() => Float)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsLongitude()
  longitude: number;
}
