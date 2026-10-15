import { registerEnumType } from '@nestjs/graphql';

// The two plans SkyCrew is sold in. Each installation serves one club, and
// its plan is set by whoever installs it, in the environment.
export enum PlanName {
  CLUB = 'club',
  ECOLE = 'ecole',
}

// What a plan may or may not include.
export enum PlanFeature {
  // Bookings with an instructor, courses, student progress, e-learning and
  // evaluations, and the instructor role.
  INSTRUCTION = 'instruction',
}

registerEnumType(PlanName, {
  name: 'PlanName',
  description: 'club: the club without instruction; ecole: everything',
});
registerEnumType(PlanFeature, { name: 'PlanFeature' });

export const PLAN_FEATURES: Record<PlanName, readonly PlanFeature[]> = {
  [PlanName.CLUB]: [],
  [PlanName.ECOLE]: [PlanFeature.INSTRUCTION],
};

export interface PlanConfig {
  plan: PlanName;
  // Null: no limit.
  maxAircraft: number | null;
  maxMembers: number | null;
}

// OWNER DECISION — without any setting, an installation gets everything with
// no limit, so that the installations made before plans existed keep what
// they had.
export const DEFAULT_PLAN: PlanConfig = {
  plan: PlanName.ECOLE,
  maxAircraft: null,
  maxMembers: null,
};

export const PLAN_ENV = {
  plan: 'SKYCREW_PLAN',
  maxAircraft: 'SKYCREW_MAX_AIRCRAFT',
  maxMembers: 'SKYCREW_MAX_MEMBERS',
} as const;

type Env = Record<string, string | undefined>;

const blank = (value: string | undefined): boolean =>
  value === undefined || value.trim() === '';

// A wrong value never stops the API from starting: it is reported in
// `problems` and replaced by the default (everything, no limit).
export const parsePlanConfig = (
  env: Env,
): { config: PlanConfig; problems: string[] } => {
  const problems: string[] = [];

  const readPlan = (): PlanName => {
    const raw = env[PLAN_ENV.plan];
    if (blank(raw)) {
      return DEFAULT_PLAN.plan;
    }
    const value = raw.trim().toLowerCase();
    if ((Object.values(PlanName) as string[]).includes(value)) {
      return value as PlanName;
    }
    problems.push(
      `${PLAN_ENV.plan}="${raw}" is not one of ${Object.values(PlanName).join(', ')}: using "${DEFAULT_PLAN.plan}"`,
    );
    return DEFAULT_PLAN.plan;
  };

  const readCap = (name: string): number | null => {
    const raw = env[name];
    if (blank(raw)) {
      return null;
    }
    const value = raw.trim();
    if (/^\d+$/.test(value) && Number(value) > 0) {
      return Number(value);
    }
    problems.push(
      `${name}="${raw}" is not a positive whole number: no limit applied`,
    );
    return null;
  };

  return {
    config: {
      plan: readPlan(),
      maxAircraft: readCap(PLAN_ENV.maxAircraft),
      maxMembers: readCap(PLAN_ENV.maxMembers),
    },
    problems,
  };
};

// Whether one more can be added when `used` are already counted.
export const hasRoomFor = (used: number, cap: number | null): boolean =>
  cap === null || used < cap;
