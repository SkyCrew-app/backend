import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class UpdateLicenseInput {
  @Field(() => Int)
  id: number;

  @Field({ nullable: true })
  license_type?: string;

  @Field({ nullable: true })
  expiration_date?: Date;

  @Field({ nullable: true })
  issue_date?: Date;

  @Field({ nullable: true })
  certification_authority?: string;
}
