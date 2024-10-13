import { InputType, Field, Int, Float } from '@nestjs/graphql';

@InputType()
export class UpdateMaintenanceInput {
  @Field(() => Int)
  id: number;

  @Field(() => Int, { nullable: true })
  aircraft_id?: number;

  @Field({ nullable: true })
  maintenance_date?: Date;

  @Field({ nullable: true })
  maintenance_type?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  parts_changed?: string;

  @Field(() => Float, { nullable: true })
  maintenance_cost?: number;

  @Field(() => Int, { nullable: true })
  technician_id?: number;
}
