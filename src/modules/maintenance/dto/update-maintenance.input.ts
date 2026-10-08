import { InputType, Field, Int, PartialType } from '@nestjs/graphql';
import { CreateMaintenanceInput } from './create-maintenance.input';

@InputType()
export class UpdateMaintenanceInput extends PartialType(
  CreateMaintenanceInput,
) {
  @Field(() => Int)
  id: number;
}
