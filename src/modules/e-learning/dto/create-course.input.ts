import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateCourseDTO {
  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;
}
