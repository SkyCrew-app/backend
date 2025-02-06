import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateCourseInstructionInput {
  @Field(() => Int)
  instructorId: number;

  @Field(() => Int)
  studentId: number;

  @Field()
  startTime: Date;

  @Field({ nullable: true })
  endTime?: Date;

  @Field({ nullable: true })
  feedback?: string;

  @Field({ nullable: true })
  rating?: number;
}
