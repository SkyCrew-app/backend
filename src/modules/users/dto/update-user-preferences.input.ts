import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class UpdateUserPreferencesInput {
  @Field({ nullable: true })
  id?: number;

  @Field({ nullable: true })
  language?: string;

  @Field({ nullable: true })
  speed_unit?: string;

  @Field({ nullable: true })
  distance_unit?: string;

  @Field({ nullable: true })
  timezone?: string;

  @Field({ nullable: true })
  preferred_aerodrome?: string;
}
