import { InputType, Field, Int, Float } from '@nestjs/graphql';
import {
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { FlightCategory } from '../entity/reservations.entity';

@InputType()
export class UpdateReservationTemplateInput {
  @Field(() => Int)
  @IsInt()
  id: number;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  aircraft_id?: number;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(6)
  day_of_week?: number;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Format HH:mm attendu' })
  preferred_start_time?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Format HH:mm attendu' })
  preferred_end_time?: string;

  @Field(() => FlightCategory, { nullable: true })
  @IsEnum(FlightCategory)
  @IsOptional()
  flight_category?: FlightCategory;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  purpose?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  notes?: string;

  @Field(() => Float, { nullable: true })
  @IsNumber()
  @IsOptional()
  estimated_flight_hours?: number;
}
