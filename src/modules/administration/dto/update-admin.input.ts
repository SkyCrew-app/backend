import { InputType, Field, PartialType, Int } from '@nestjs/graphql';
import { CreateAdministrationInput } from './create-admin.input';

@InputType()
export class UpdateAdministrationInput extends PartialType(
  CreateAdministrationInput,
) {
  @Field(() => Int)
  id: number;
}
