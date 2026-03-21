import { InputType, Field, Int } from '@nestjs/graphql';
import { IsInt, IsString, IsBoolean, IsOptional } from 'class-validator';

@InputType()
export class UpdateChecklistTemplateInput {
  @Field(() => Int)
  @IsInt()
  id: number;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  aircraft_model?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field(() => Boolean, { nullable: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
