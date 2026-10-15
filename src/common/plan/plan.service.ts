import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { localized } from '../i18n/localized-exception';
import {
  hasRoomFor,
  PLAN_ENV,
  PLAN_FEATURES,
  PlanConfig,
  PlanFeature,
  PlanName,
  parsePlanConfig,
} from './plan';

// The plan of this installation, read once when the API starts (see
// SKYCREW_PLAN, SKYCREW_MAX_AIRCRAFT and SKYCREW_MAX_MEMBERS). Changing it
// means changing the environment and restarting.
@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);
  private readonly config: PlanConfig;

  constructor(@Optional() configService?: ConfigService) {
    const read = (name: string): string | undefined =>
      configService?.get<string>(name) ?? process.env[name];
    const { config, problems } = parsePlanConfig({
      [PLAN_ENV.plan]: read(PLAN_ENV.plan),
      [PLAN_ENV.maxAircraft]: read(PLAN_ENV.maxAircraft),
      [PLAN_ENV.maxMembers]: read(PLAN_ENV.maxMembers),
    });
    for (const problem of problems) {
      this.logger.error(problem);
    }
    this.config = config;
  }

  // For tests and scripts: a service with a given plan.
  static of(config: Partial<PlanConfig>): PlanService {
    const service = new PlanService({
      get: (name: string) =>
        ({
          [PLAN_ENV.plan]: config.plan ?? PlanName.ECOLE,
          [PLAN_ENV.maxAircraft]:
            config.maxAircraft != null ? String(config.maxAircraft) : '',
          [PLAN_ENV.maxMembers]:
            config.maxMembers != null ? String(config.maxMembers) : '',
        })[name],
    } as ConfigService);
    return service;
  }

  get plan(): PlanName {
    return this.config.plan;
  }

  get maxAircraft(): number | null {
    return this.config.maxAircraft;
  }

  get maxMembers(): number | null {
    return this.config.maxMembers;
  }

  get features(): PlanFeature[] {
    return [...PLAN_FEATURES[this.config.plan]];
  }

  includes(feature: PlanFeature): boolean {
    return PLAN_FEATURES[this.config.plan].includes(feature);
  }

  assertIncludes(feature: PlanFeature): void {
    if (!this.includes(feature)) {
      throw localized(ForbiddenException, 'error.plan.featureNotIncluded');
    }
  }

  // `inService`: the aircraft that already use a place.
  assertRoomForAircraft(inService: number): void {
    if (!hasRoomFor(inService, this.config.maxAircraft)) {
      throw localized(ConflictException, 'error.plan.aircraftLimit', {
        max: this.config.maxAircraft,
      });
    }
  }

  // `active`: the members whose account is already active.
  assertRoomForMember(active: number): void {
    if (!hasRoomFor(active, this.config.maxMembers)) {
      throw localized(ConflictException, 'error.plan.memberLimit', {
        max: this.config.maxMembers,
      });
    }
  }
}
