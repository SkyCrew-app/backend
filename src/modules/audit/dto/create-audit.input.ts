import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateAuditInput {
  @Field(() => Int)
  aircraft_id: number;

  @Field()
  audit_date: Date;

  @Field()
  audit_result: string;

  @Field({ nullable: true })
  corrective_actions?: string;

  @Field({ nullable: true })
  next_audit_date?: Date;

  @Field()
  audit_frequency: string;
}
