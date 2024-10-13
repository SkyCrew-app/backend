import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class UpdateAuditInput {
  @Field(() => Int)
  id: number;

  @Field({ nullable: true })
  audit_date?: Date;

  @Field({ nullable: true })
  audit_result?: string;

  @Field({ nullable: true })
  corrective_actions?: string;

  @Field({ nullable: true })
  next_audit_date?: Date;

  @Field({ nullable: true })
  audit_frequency?: string;
}
