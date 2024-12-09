import { InputType, Field, PartialType } from '@nestjs/graphql';
import { CreateArticleInput } from './create-article.input';

@InputType()
export class UpdateArticleInput extends PartialType(CreateArticleInput) {
  @Field()
  id: number;
}
