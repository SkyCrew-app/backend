import { InputType, Field, Int } from '@nestjs/graphql';
import { AuditResultType } from '../enums/audit-result.enum';
import { AuditFrequencyType } from '../enums/audit-frequency.enum';
import {
  IsNotEmpty,
  IsDate,
  IsOptional,
  IsEnum,
  IsInt,
  IsString,
} from 'class-validator';

@InputType()
export class CreateAuditInput {
  @Field(() => Int)
  @IsInt()
  @IsNotEmpty()
  aircraftId: number;

  @Field(() => Int)
  @IsInt()
  @IsNotEmpty()
  auditorId: number;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  templateId?: number;

  @Field()
  @IsDate()
  @IsNotEmpty()
  audit_date: Date;

  @Field(() => AuditResultType)
  @IsEnum(AuditResultType)
  @IsNotEmpty()
  audit_result: AuditResultType;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  audit_notes?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  corrective_actions?: string;

  @Field(() => AuditFrequencyType)
  @IsEnum(AuditFrequencyType)
  @IsNotEmpty()
  audit_frequency: AuditFrequencyType;

  @Field({ nullable: true })
  @IsDate()
  @IsOptional()
  next_audit_date?: Date;
}
