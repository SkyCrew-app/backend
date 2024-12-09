import { InputType, Field, Int } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';

@InputType()
export class UpdateLicenseInput {
  @Field(() => Int)
  id: number;

  @Field({ nullable: true })
  @IsOptional()
  license_type?: string;

  @Field({ nullable: true })
  @IsOptional()
  expiration_date?: Date;

  @Field({ nullable: true })
  @IsOptional()
  issue_date?: Date;

  @Field({ nullable: true })
  @IsOptional()
  certification_authority?: string;

  @Field({ nullable: true })
  @IsOptional()
  is_valid?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  status?: 'active' | 'expired' | 'pending';

  @Field({ nullable: true })
  @IsOptional()
  license_number: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  documents_url?: string[];
}
