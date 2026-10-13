import { InputType, Field } from '@nestjs/graphql';
import { IsPhoneNumberField } from '../../../common/validation/phone-number';

@InputType()
export class UpdateUserInput {
  // With `email`, identifies the account: they must agree.
  @Field({ nullable: true })
  id?: number;

  @Field({ nullable: true })
  first_name?: string;

  @Field({ nullable: true })
  last_name?: string;

  // Identifies the user to update. Only administrators may target
  // someone else; other callers always update their own account.
  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  @IsPhoneNumberField({ optional: true })
  phone_number?: string;

  @Field({ nullable: true })
  address?: string;

  @Field({ nullable: true })
  date_of_birth?: Date;

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
