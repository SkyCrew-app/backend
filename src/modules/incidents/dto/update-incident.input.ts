import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class UpdateIncidentInput {
  @Field(() => Int)
  id: number;

  @Field(() => Int, { nullable: true })
  aircraft_id?: number;

  @Field(() => Int, { nullable: true })
  user_id?: number;

  @Field({ nullable: true })
  incident_date?: Date;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  damage_report?: string;

  @Field({ nullable: true })
  corrective_actions?: string;

  @Field({ nullable: true })
  severity_level?: string;
}
