import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateNotificationInput {
  @Field(() => Int)
  user_id: number;

  @Field()
  notification_type: string;

  @Field()
  message: string;

  @Field()
  notification_date: Date;

  @Field({ nullable: true })
  expiration_date?: Date;

  @Field(() => Boolean, { nullable: true })
  is_read?: boolean;

  @Field({ nullable: true })
  action_url?: string;

  @Field({ nullable: true })
  priority?: string;
}
