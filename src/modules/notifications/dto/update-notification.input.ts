import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class UpdateNotificationInput {
  @Field(() => Int)
  id: number;

  @Field({ nullable: true })
  notification_type?: string;

  @Field({ nullable: true })
  message?: string;

  @Field({ nullable: true })
  notification_date?: Date;

  @Field({ nullable: true })
  expiration_date?: Date;

  @Field(() => Boolean, { nullable: true })
  is_read?: boolean;

  @Field({ nullable: true })
  action_url?: string;

  @Field({ nullable: true })
  priority?: string;
}
