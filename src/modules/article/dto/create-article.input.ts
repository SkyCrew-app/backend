import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateArticleInput {
  @Field()
  title: string;

  @Field()
  description: string;

  @Field()
  text: string;

  @Field(() => [String])
  tags: string[];

  @Field({ nullable: true })
  photo?: string;

  @Field({ nullable: true })
  documents?: string;

  @Field({ nullable: true })
  eventDate?: Date;
}
