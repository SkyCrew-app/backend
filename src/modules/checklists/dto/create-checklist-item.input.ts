import { InputType, Field, Int } from '@nestjs/graphql';
import { IsInt, IsString, IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { ChecklistCategory } from '../entity/checklist-item.entity';

@InputType()
export class CreateChecklistItemInput {
  @Field(() => Int)
  @IsInt()
  templateId: number;

  @Field(() => ChecklistCategory)
  @IsEnum(ChecklistCategory)
  category: ChecklistCategory;

  @Field()
  @IsString()
  item_name: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field(() => Boolean, { nullable: true })
  @IsBoolean()
  @IsOptional()
  is_required?: boolean;

  @Field(() => Int)
  @IsInt()
  sort_order: number;
}
