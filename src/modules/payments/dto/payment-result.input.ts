import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { User } from '../../users/entity/users.entity';

@ObjectType()
export class PaymentResult {
  @Field(() => Int)
  id: number;

  @Field(() => Float)
  amount: number;

  @Field()
  payment_method: string;

  @Field()
  payment_status: string;

  @Field()
  external_payment_id: string;

  @Field({ nullable: true })
  client_secret: string;

  @Field(() => User)
  user: User;
}
