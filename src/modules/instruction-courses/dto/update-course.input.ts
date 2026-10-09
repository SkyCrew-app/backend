import { InputType, Field, Int, PartialType } from '@nestjs/graphql';
import { CreateCourseInstructionInput } from './create-course.input';
import { CourseStatus } from '../enum/course-status.enum';

@InputType()
export class UpdateCourseInstructionInput extends PartialType(
  CreateCourseInstructionInput,
) {
  @Field(() => Int)
  id: number;

  @Field(() => CourseStatus, { nullable: true })
  status?: CourseStatus;
}
