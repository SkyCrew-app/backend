import { ObjectType, InputType, Field, Int } from '@nestjs/graphql';
import { IsInt, IsBoolean, IsString, IsOptional } from 'class-validator';

@ObjectType('ChecklistResponse')
export class ChecklistResponse {
  @Field(() => Int)
  itemId: number;

  @Field(() => Boolean)
  checked: boolean;

  @Field({ nullable: true })
  note?: string;
}

@InputType('ChecklistResponseInput')
export class ChecklistResponseInput {
  @Field(() => Int)
  @IsInt()
  itemId: number;

  @Field(() => Boolean)
  @IsBoolean()
  checked: boolean;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  note?: string;
}
