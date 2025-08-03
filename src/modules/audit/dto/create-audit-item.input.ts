import { InputType, Field } from '@nestjs/graphql';
import { AuditResultType } from '../enums/audit-result.enum';
import { AuditCategoryType } from '../enums/audit-category.enum';
import {
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
  IsBoolean,
} from 'class-validator';

@InputType()
export class CreateAuditItemInput {
  @Field(() => AuditCategoryType)
  @IsEnum(AuditCategoryType)
  @IsNotEmpty()
  category: AuditCategoryType;

  @Field()
  @IsString()
  @IsNotEmpty()
  description: string;

  @Field(() => AuditResultType)
  @IsEnum(AuditResultType)
  @IsNotEmpty()
  result: AuditResultType;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  notes?: string;

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  requires_action?: boolean;
}
