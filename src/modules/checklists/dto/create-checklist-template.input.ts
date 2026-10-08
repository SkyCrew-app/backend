import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsOptional } from 'class-validator';

@InputType()
export class CreateChecklistTemplateInput {
  @Field()
  @IsString()
  aircraft_model: string;

  @Field()
  @IsString()
  name: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;
}
