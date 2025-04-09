import { InputType, Field, Int } from '@nestjs/graphql';
import { AuditResultType } from '../enums/audit-result.enum';

@InputType()
export class AuditFilterInput {
  @Field(() => Int, { nullable: true })
  aircraftId?: number;

  @Field(() => AuditResultType, { nullable: true })
  auditResult?: AuditResultType;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  endDate?: Date;

  @Field({ nullable: true })
  isClosed?: boolean;
}
