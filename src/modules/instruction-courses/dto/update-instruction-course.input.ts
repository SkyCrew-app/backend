import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class UpdateInstructionCourseInput {
  @Field(() => Int)
  id: number;

  @Field(() => Int, { nullable: true })
  instructor_id?: number;

  @Field(() => Int, { nullable: true })
  student_id?: number;

  @Field({ nullable: true })
  course_date?: Date;

  @Field({ nullable: true })
  feedback?: string;

  @Field({ nullable: true })
  skills_taught?: string;

  @Field({ nullable: true })
  course_level?: string;
}
