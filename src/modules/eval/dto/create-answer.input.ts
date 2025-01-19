import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateAnswerDTO {
  @Field(() => Number, { description: 'Question ID the answer is related to' })
  questionId: number;

  @Field(() => String, {
    nullable: true,
    description: 'User-provided answer text',
  })
  answer_text?: string;

  @Field(() => Boolean, { description: 'Indicates if the answer is correct' })
  is_correct: boolean;
}
