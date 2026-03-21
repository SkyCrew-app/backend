import { InputType, Field, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ChecklistResponseInput } from './checklist-response.type';

@InputType()
export class SubmitChecklistInput {
  @Field(() => Int)
  @IsInt()
  templateId: number;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  reservationId?: number;

  @Field(() => [ChecklistResponseInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistResponseInput)
  responses: ChecklistResponseInput[];
}
