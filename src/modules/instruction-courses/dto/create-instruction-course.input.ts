import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateInstructionCourseInput {
  @Field(() => Int)
  instructor_id: number;

  @Field(() => Int)
  student_id: number;

  @Field()
  course_date: Date;

  @Field({ nullable: true })
  feedback?: string;

  @Field({ nullable: true })
  skills_taught?: string;

  @Field()
  course_level: string;
}
