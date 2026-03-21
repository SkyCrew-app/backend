import { InputType, Field, Int } from '@nestjs/graphql';
import { IsInt, IsBoolean, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ChecklistResponseInput } from './checklist-response.type';

@InputType()
export class UpdateChecklistSubmissionInput {
  @Field(() => Int)
  @IsInt()
  id: number;

  @Field(() => [ChecklistResponseInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistResponseInput)
  responses: ChecklistResponseInput[];

  @Field(() => Boolean, { nullable: true })
  @IsBoolean()
  @IsOptional()
  completed?: boolean;
}
