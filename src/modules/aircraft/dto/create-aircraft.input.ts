import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { IsOptional, IsString, IsNumber, IsInt } from 'class-validator';
import { AvailabilityStatus } from '../entity/aircraft.entity';

@InputType()
export class CreateAircraftInput {
  @Field()
  @IsString()
  registration_number: string;

  @Field()
  @IsString()
  model: string;

  @Field(() => Int)
  @IsInt()
  year_of_manufacture: number;

  @Field(() => AvailabilityStatus)
  availability_status: AvailabilityStatus;

  @Field()
  @IsString()
  maintenance_status: string;

  @Field(() => Float)
  @IsNumber()
  hourly_cost: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  image_url?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsString({ each: true })
  documents_url?: string[];

  @Field({ nullable: true })
  @IsOptional()
  last_inspection_date?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  current_location?: string;
}
