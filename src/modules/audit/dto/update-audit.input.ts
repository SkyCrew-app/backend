import { InputType, Field, Int } from '@nestjs/graphql';
import { AuditResultType } from '../enums/audit-result.enum';
import { AuditFrequencyType } from '../enums/audit-frequency.enum';
import {
  IsOptional,
  IsDate,
  IsEnum,
  IsInt,
  IsString,
  IsBoolean,
} from 'class-validator';

@InputType()
export class UpdateAuditInput {
  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  aircraftId?: number;

  @Field({ nullable: true })
  @IsDate()
  @IsOptional()
  audit_date?: Date;

  @Field(() => AuditResultType, { nullable: true })
  @IsEnum(AuditResultType)
  @IsOptional()
  audit_result?: AuditResultType;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  audit_notes?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  corrective_actions?: string;

  @Field({ nullable: true })
  @IsDate()
  @IsOptional()
  next_audit_date?: Date;

  @Field(() => AuditFrequencyType, { nullable: true })
  @IsEnum(AuditFrequencyType)
  @IsOptional()
  audit_frequency?: AuditFrequencyType;

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  is_closed?: boolean;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  closedById?: number;
}
