import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateEvaluationDTO {
  @Field(() => Number, { description: 'Module ID the evaluation belongs to' })
  moduleId: number;

  @Field({ description: 'Minimum score required to pass the evaluation' })
  pass_score: number;
}
