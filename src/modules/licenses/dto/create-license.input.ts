import { InputType, Field, Int } from '@nestjs/graphql';
import { IsInt, IsString, IsOptional } from 'class-validator';

@InputType()
export class CreateLicenseInput {
  @Field(() => Int)
  @IsInt()
  user_id: number;

  @Field()
  @IsString()
  license_type: string;

  @Field({ nullable: true })
  expiration_date: Date;

  @Field()
  issue_date: Date;

  @Field()
  @IsString()
  license_number: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  certification_authority?: string;

  @Field({ defaultValue: 'active' })
  @IsString()
  status: 'active' | 'expired' | 'pending';

  @Field({ nullable: true })
  last_updated?: Date;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsString({ each: true })
  documents_url?: string[];
}
