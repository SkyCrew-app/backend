import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class AddCompetencyInput {
  @Field(() => Int)
  courseId: number;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;
}
