import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Aerodrome {
  @Field({ nullable: true })
  icao?: string;

  @Field({ nullable: true })
  iata?: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  city?: string;

  @Field({ nullable: true })
  country?: string;

  @Field(() => Float, { nullable: true })
  latitude?: number;

  @Field(() => Float, { nullable: true })
  longitude?: number;

  @Field({ nullable: true, description: 'IANA time zone, e.g. Europe/Paris' })
  timezone?: string;
}
