import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class UpdateUserInput {
  @Field(() => Int)
  id: number;

  @Field({ nullable: true })
  first_name?: string;

  @Field({ nullable: true })
  last_name?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone_number?: string;

  @Field({ nullable: true })
  address?: string;

  @Field({ nullable: true })
  date_of_birth?: Date;

  @Field({ nullable: true })
  membership_start_date?: Date;

  @Field({ nullable: true })
  membership_end_date?: Date;

  @Field({ nullable: true })
  is_instructor?: boolean;
}
