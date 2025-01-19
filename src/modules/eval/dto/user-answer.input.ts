import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class UserAnswerInput {
  @Field(() => Int, { description: 'The ID of the question' })
  questionId: number;

  @Field(() => String, { description: 'The user-provided answer' })
  answer: string;
}
