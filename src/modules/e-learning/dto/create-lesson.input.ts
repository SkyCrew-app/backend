import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateLessonDTO {
  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => String, { description: 'Rich content in JSON format' })
  content: any;

  @Field({ nullable: true })
  video_url?: string;

  @Field(() => Number, { description: 'Module ID the lesson belongs to' })
  moduleId: number;
}
