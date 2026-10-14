import { UseGuards } from '@nestjs/common';
import { Field, Int, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { PlanFeature, PlanName } from './plan';
import { PlanService } from './plan.service';
import { countActiveMembers, countAircraftInService } from './plan-usage';

@ObjectType('ClubPlan')
export class ClubPlan {
  @Field(() => PlanName)
  plan: PlanName;

  @Field(() => [PlanFeature])
  features: PlanFeature[];

  @Field(() => Int, {
    nullable: true,
    description: 'Aircraft in service allowed; null: no limit',
  })
  maxAircraft: number | null;

  @Field(() => Int, { description: 'Aircraft in service now' })
  aircraftInService: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Active members allowed; null: no limit',
  })
  maxMembers: number | null;

  @Field(() => Int, { description: 'Active members now' })
  activeMembers: number;
}

@Resolver(() => ClubPlan)
export class PlanResolver {
  constructor(
    private readonly planService: PlanService,
    @InjectEntityManager() private readonly manager: EntityManager,
  ) {}

  // Every signed-in member: the interface shows only what the plan includes.
  @Query(() => ClubPlan, { name: 'plan' })
  @UseGuards(JwtAuthGuard)
  async plan(): Promise<ClubPlan> {
    const [aircraftInService, activeMembers] = await Promise.all([
      countAircraftInService(this.manager),
      countActiveMembers(this.manager),
    ]);
    return {
      plan: this.planService.plan,
      features: this.planService.features,
      maxAircraft: this.planService.maxAircraft,
      aircraftInService,
      maxMembers: this.planService.maxMembers,
      activeMembers,
    };
  }
}
