import { Global, Module } from '@nestjs/common';
import { PlanService } from './plan.service';
import { PlanResolver } from './plan.resolver';
import { PlanFeatureGuard } from './plan-feature.guard';

// Global: any service may ask what the plan includes.
@Global()
@Module({
  providers: [PlanService, PlanResolver, PlanFeatureGuard],
  exports: [PlanService, PlanFeatureGuard],
})
export class PlanModule {}
