import { InputType, Field } from '@nestjs/graphql';
import { AuditResultType } from '../enums/audit-result.enum';
import { AuditCategoryType } from '../enums/audit-category.enum';
import { IsOptional, IsEnum, IsString, IsBoolean } from 'class-validator';

@InputType()
export class UpdateAuditItemInput {
  @Field(() => AuditCategoryType, { nullable: true })
  @IsEnum(AuditCategoryType)
  @IsOptional()
  category?: AuditCategoryType;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field(() => AuditResultType, { nullable: true })
  @IsEnum(AuditResultType)
  @IsOptional()
  result?: AuditResultType;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  notes?: string;

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  requires_action?: boolean;
}
