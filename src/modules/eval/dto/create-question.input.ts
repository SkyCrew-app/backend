import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateQuestionDTO {
  @Field(() => Number, { description: 'Evaluation ID the question belongs to' })
  evaluationId: number;

  @Field(() => String, { description: 'Rich content in JSON format' })
  content: any;

  @Field(() => [String], { description: 'List of possible answers' })
  options: string[];

  @Field({ description: 'Correct answer' })
  correct_answer: string;
}
