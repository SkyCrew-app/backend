import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class AddCommentInput {
  @Field(() => Int)
  courseId: number;

  @Field()
  content: string;

  @Field(() => Int)
  author: number;
}
