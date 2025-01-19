import { InputType, Field, PartialType } from '@nestjs/graphql';
import { CreateUserProgressDTO } from './create-user-progress.input';

@InputType()
export class UpdateUserProgressDTO extends PartialType(CreateUserProgressDTO) {
  @Field(() => Boolean, {
    nullable: true,
    description: 'Mark the lesson as completed',
  })
  completed?: boolean;

  @Field({
    nullable: true,
    description: 'Timestamp when the lesson was completed',
  })
  completed_at?: Date;
}
