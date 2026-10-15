import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanFeature } from './plan';
import { PlanService } from './plan.service';

export const PLAN_FEATURE_KEY = 'planFeature';

// Marks an operation (or every operation of a resolver) as part of a feature
// some plans do not include: see PlanFeatureGuard.
export const RequiresPlanFeature = (feature: PlanFeature) =>
  SetMetadata(PLAN_FEATURE_KEY, feature);

// Global guard: an operation marked with @RequiresPlanFeature is refused when
// the plan of the installation does not include that feature. Field
// resolvers are not guarded, so what was recorded stays readable through
// the operations that remain.
@Injectable()
export class PlanFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly plan: PlanService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const feature = this.reflector.getAllAndOverride<PlanFeature | undefined>(
      PLAN_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (feature) {
      this.plan.assertIncludes(feature);
    }
    return true;
  }
}
