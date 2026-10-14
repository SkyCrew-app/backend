import { InputType, Field, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString } from 'class-validator';

// What a member enters about their own licence. Its holder is the session's
// member and its status is set by the API (pending until an administrator
// validates it): neither is sent.
@InputType()
export class AddMyLicenseInput {
  @Field()
  @IsString()
  license_type: string;

  @Field()
  @IsString()
  license_number: string;

  @Field()
  issue_date: Date;

  @Field({ nullable: true })
  @IsOptional()
  expiration_date?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  certification_authority?: string;
}

@InputType()
export class UpdateMyLicenseInput {
  @Field(() => Int)
  @IsInt()
  id: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  license_type?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  license_number?: string;

  @Field({ nullable: true })
  @IsOptional()
  issue_date?: Date;

  @Field({ nullable: true })
  @IsOptional()
  expiration_date?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  certification_authority?: string;
}
