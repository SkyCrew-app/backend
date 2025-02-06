import { InputType, Field, Int, PartialType } from '@nestjs/graphql';
import { CreateCourseInstructionInput } from './create-course.input';

@InputType()
export class UpdateCourseInstructionInput extends PartialType(
  CreateCourseInstructionInput,
) {
  @Field(() => Int)
  id: number;
}
