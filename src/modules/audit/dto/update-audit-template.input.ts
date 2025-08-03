import { InputType, Field } from '@nestjs/graphql';
import { AuditFrequencyType } from '../enums/audit-frequency.enum';
import {
  IsOptional,
  IsEnum,
  IsString,
  IsArray,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateAuditTemplateItemInput } from './create-audit-template-item.input';

@InputType()
export class UpdateAuditTemplateInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field(() => AuditFrequencyType, { nullable: true })
  @IsEnum(AuditFrequencyType)
  @IsOptional()
  recommended_frequency?: AuditFrequencyType;

  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  applicable_aircraft_types?: string[];

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @Field(() => [CreateAuditTemplateItemInput], { nullable: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAuditTemplateItemInput)
  @IsOptional()
  items?: CreateAuditTemplateItemInput[];
}
