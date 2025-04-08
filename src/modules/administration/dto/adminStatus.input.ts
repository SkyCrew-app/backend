import { ObjectType, Field, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class UsersByRole {
  @Field(() => Int)
  roleId: number;

  @Field()
  role_name: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class ReservationsByCategory {
  @Field()
  flight_category: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class adminStatus {
  @Field(() => Int)
  totalUsers: number;

  @Field(() => Int)
  totalAircrafts: number;

  @Field(() => Int)
  totalReservations: number;

  @Field(() => Int)
  totalFlights: number;

  @Field(() => Int)
  totalIncidents: number;

  @Field(() => Int)
  availableAircrafts: number;

  @Field(() => Int)
  pendingReservations: number;

  @Field(() => Float)
  flightHoursThisMonth: number;

  @Field(() => [UsersByRole])
  usersByRole: UsersByRole[];

  @Field(() => [ReservationsByCategory])
  reservationsByCategory: ReservationsByCategory[];
}
