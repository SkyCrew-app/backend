import { InputType, Field, Int } from '@nestjs/graphql';
import { IsDate, IsInt, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { LogbookRole } from '../logbook-role';

@InputType()
export class LogbookFilterInput {
  @Field(() => Date, { nullable: true })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startDate?: Date;

  @Field(() => Date, { nullable: true })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  endDate?: Date;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  aircraftId?: number;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  flightType?: string;

  // Only the flights where the member took this part.
  @Field(() => LogbookRole, { nullable: true })
  @IsOptional()
  role?: LogbookRole;
}
