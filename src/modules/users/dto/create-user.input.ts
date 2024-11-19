import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateUserInput {
  @Field()
  first_name: string;

  @Field()
  last_name: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  password?: string;

  @Field({ nullable: true })
  is2FAEnabled?: boolean;

  @Field({ nullable: true })
  twoFactorAuthSecret?: string;

  @Field({ nullable: true })
  phone_number?: string;

  @Field({ nullable: true })
  address?: string;

  @Field()
  date_of_birth: Date;

  @Field({ nullable: true })
  profile_picture?: string;

  @Field({ nullable: true })
  total_flight_hours?: number;

  @Field({ nullable: false })
  user_account_balance?: number;

  @Field({ nullable: true })
  membership_start_date?: Date;

  @Field({ nullable: true })
  membership_end_date?: Date;

  @Field({ nullable: true })
  is_instructor?: boolean;
}
