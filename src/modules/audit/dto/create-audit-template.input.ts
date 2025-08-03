import { InputType, Field, Int } from '@nestjs/graphql';
import { AuditFrequencyType } from '../enums/audit-frequency.enum';
import {
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
  IsArray,
  IsInt,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateAuditTemplateItemInput } from './create-audit-template-item.input';

@InputType()
export class CreateAuditTemplateInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  description: string;

  @Field(() => AuditFrequencyType)
  @IsEnum(AuditFrequencyType)
  @IsNotEmpty()
  recommended_frequency: AuditFrequencyType;

  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  applicable_aircraft_types?: string[];

  @Field(() => Int)
  @IsInt()
  @IsNotEmpty()
  createdById: number;

  @Field(() => [CreateAuditTemplateItemInput], { nullable: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAuditTemplateItemInput)
  @IsOptional()
  items?: CreateAuditTemplateItemInput[];
}
