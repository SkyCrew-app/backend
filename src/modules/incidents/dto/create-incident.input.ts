import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateIncidentInput {
  @Field(() => Int)
  aircraft_id: number;

  @Field(() => Int)
  user_id: number;

  @Field()
  incident_date: Date;

  @Field()
  description: string;

  @Field({ nullable: true })
  damage_report?: string;

  @Field({ nullable: true })
  corrective_actions?: string;

  @Field()
  severity_level: string;
}
