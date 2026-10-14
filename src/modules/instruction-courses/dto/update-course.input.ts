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

  // With a cancellation: also cancel the aircraft booking of the course,
  // refunded to the student, as cancelling the booking itself would.
  @Field(() => Boolean, { nullable: true })
  cancelBooking?: boolean;
}
