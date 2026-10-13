import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AerodromeWeather {
  @Field(() => Float, { nullable: true, description: 'Degrees Celsius' })
  temperature?: number;

  @Field(() => Float, { nullable: true, description: 'Degrees Celsius' })
  feelsLike?: number;

  @Field(() => Float, { nullable: true, description: 'Percent' })
  humidity?: number;

  @Field(() => Float, { nullable: true, description: 'Percent' })
  cloudCover?: number;

  @Field(() => Float, { nullable: true })
  windSpeed?: number;

  @Field(() => Float, { nullable: true, description: 'Degrees' })
  windDegrees?: number;

  @Field(() => Int, { nullable: true, description: 'Unix time, in seconds' })
  sunrise?: number;

  @Field(() => Int, { nullable: true, description: 'Unix time, in seconds' })
  sunset?: number;
}
