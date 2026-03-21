import { InputType, Field, Int } from '@nestjs/graphql';
import { IsInt, IsString, IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { ChecklistCategory } from '../entity/checklist-item.entity';

@InputType()
export class UpdateChecklistItemInput {
  @Field(() => Int)
  @IsInt()
  id: number;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  item_name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field(() => Boolean, { nullable: true })
  @IsBoolean()
  @IsOptional()
  is_required?: boolean;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  sort_order?: number;

  @Field(() => ChecklistCategory, { nullable: true })
  @IsEnum(ChecklistCategory)
  @IsOptional()
  category?: ChecklistCategory;
}
