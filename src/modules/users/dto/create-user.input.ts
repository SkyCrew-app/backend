import { InputType, Field } from '@nestjs/graphql';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsDate,
  MinLength,
} from 'class-validator';

@InputType()
export class CreateUserInput {
  @Field()
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est requis' })
  first_name: string;

  @Field()
  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  last_name: string;

  @Field()
  @IsEmail({}, { message: 'Email invalide' })
  @IsNotEmpty({ message: "L'email est requis" })
  email: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
  password?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  is2FAEnabled?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  twoFactorAuthSecret?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  address?: string;

  @Field()
  @IsDate()
  date_of_birth: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  profile_picture?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  total_flight_hours?: number;

  @Field({ nullable: false })
  @IsNumber()
  user_account_balance?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  membership_start_date?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  membership_end_date?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  is_instructor?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  language?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  speed_unit?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  distance_unit?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  timezone?: string;
}
