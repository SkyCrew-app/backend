import { InputType, Field } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';

@InputType()
export class CreateQuestionDTO {
  @Field(() => GraphQLJSONObject)
  content: object;

  @Field(() => [String], { description: 'List of possible answers' })
  options: string[];

  @Field({ description: 'Correct answer' })
  correct_answer: string;
}
