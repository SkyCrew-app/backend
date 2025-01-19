import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateUserProgressDTO {
  @Field(() => Number, { description: 'User ID associated with this progress' })
  userId: number;

  @Field(() => Number, { description: 'Lesson ID the user is progressing in' })
  lessonId: number;
}
