import { InputType, Field, Float, Int } from '@nestjs/graphql';

@InputType()
export class CreateAdministrationInput {
  @Field()
  clubName: string;

  @Field()
  contactEmail: string;

  @Field()
  contactPhone: string;

  @Field()
  address: string;

  @Field(() => [String])
  closureDays: string[];

  @Field(() => Int)
  timeSlotDuration: number;

  @Field()
  reservationStartTime: string;

  @Field()
  reservationEndTime: string;

  @Field()
  maintenanceDay: string;

  @Field(() => Int)
  maintenanceDuration: number;

  @Field(() => [String])
  pilotLicenses: string[];

  @Field(() => Float)
  membershipFee: number;

  @Field(() => Float)
  flightHourRate: number;

  @Field()
  clubRules: string;

  @Field()
  allowGuestPilots: boolean;

  @Field(() => Float, { nullable: true })
  guestPilotFee?: number;

  @Field()
  fuelManagement: 'self-service' | 'staff-only' | 'external';
}
