import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { MaintenanceType } from '../entity/maintenance-type.enum';

@InputType()
export class CreateMaintenanceInput {
  @Field(() => Int)
  aircraft_id: number;

  @Field(() => Date)
  start_date: Date;

  @Field(() => Date)
  end_date: Date;

  @Field(() => MaintenanceType, { nullable: true })
  maintenance_type?: MaintenanceType;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  parts_changed?: string;

  @Field(() => Float, { nullable: true })
  maintenance_cost?: number;

  @Field(() => Int, { nullable: true })
  technician_id?: number;

  @Field(() => [String], { nullable: true })
  images_url?: string[];

  @Field(() => [String], { nullable: true })
  documents_url?: string[];
}
