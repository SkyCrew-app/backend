import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateIncidentInput {
  @Field(() => Int)
  aircraft_id: number;

  // Optional: an incident may be seen on the ground, without a flight. When
  // given, it is a flight of the member reporting (staff: anybody's).
  @Field(() => Int, { nullable: true })
  flight_id?: number | null;

  // Staff only: who the incident is recorded for. Ignored for a member.
  @Field(() => Int, { nullable: true })
  user_id?: number | null;

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

  @Field()
  status: string;

  @Field()
  priority: string;

  @Field()
  category: string;
}
