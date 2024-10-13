import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class UpdateRoleInput {
  @Field(() => Int)
  id: number;

  @Field({ nullable: true })
  role_name?: string;
}
