import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateModuleDTO {
  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Number, { description: 'Course ID the module belongs to' })
  courseId: number;
}
