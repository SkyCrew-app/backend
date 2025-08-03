import { InputType, Field, Int } from '@nestjs/graphql';
import { AuditCategoryType } from '../enums/audit-category.enum';
import { CriticalityLevel } from '../enums/criticality-level.enum';
import {
  IsOptional,
  IsEnum,
  IsString,
  IsBoolean,
  IsInt,
} from 'class-validator';

@InputType()
export class UpdateAuditTemplateItemInput {
  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  order_index?: number;

  @Field(() => AuditCategoryType, { nullable: true })
  @IsEnum(AuditCategoryType)
  @IsOptional()
  category?: AuditCategoryType;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  title?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  inspection_method?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  expected_result?: string;

  @Field(() => CriticalityLevel, { nullable: true })
  @IsEnum(CriticalityLevel)
  @IsOptional()
  criticality?: CriticalityLevel;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  reference_documentation?: string;

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  requires_photo_evidence?: boolean;

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  is_mandatory?: boolean;
}
