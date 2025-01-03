import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  first_name?: string;

  @Field({ nullable: true })
  last_name?: string;

  @Field({ nullable: false })
  email: string;

  @Field({ nullable: true })
  password?: string;

  @Field({ nullable: true })
  profile_picture?: string;

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

  @Field({ nullable: true })
  language?: string;

  @Field({ nullable: true })
  speed_unit?: string;

  @Field({ nullable: true })
  distance_unit?: string;

  @Field({ nullable: true })
  timezone?: string;

  @Field({ nullable: true })
  roleId?: number;
}
