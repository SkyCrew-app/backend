import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateLicenseInput {
  @Field(() => Int)
  user_id: number;

  @Field()
  license_type: string;

  @Field()
  expiration_date: Date;

  @Field()
  issue_date: Date;

  @Field({ nullable: true })
  certification_authority?: string;
}
