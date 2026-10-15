import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { translationOf } from '../../i18n/localized-exception';
import { renderTranslation } from '../../i18n/translate';
import {
  DEFAULT_PLAN,
  hasRoomFor,
  parsePlanConfig,
  PlanFeature,
  PlanName,
} from '../plan';
import { PlanService } from '../plan.service';
import { PLAN_FEATURE_KEY, PlanFeatureGuard } from '../plan-feature.guard';
import { PlanResolver } from '../plan.resolver';
import { InstructionCoursesResolver } from '../../../modules/instruction-courses/instruction-courses.resolver';
import {
  CourseResolver,
  LessonResolver,
  ModuleResolver,
} from '../../../modules/e-learning/e-learning.resolver';
import {
  AnswerResolver,
  EvaluationResolver,
  QuestionResolver,
} from '../../../modules/eval/eval.resolver';
import { UserProgressResolver } from '../../../modules/users/users.resolver';
import { ReservationsResolver } from '../../../modules/reservations/reservations.resolver';

const keyOf = (run: () => unknown): string | null => {
  try {
    run();
    return null;
  } catch (error) {
    return translationOf(error)?.key ?? null;
  }
};

describe('the plan of an installation', () => {
  it('is everything with no limit when nothing is set', () => {
    expect(parsePlanConfig({})).toEqual({ config: DEFAULT_PLAN, problems: [] });
    expect(DEFAULT_PLAN).toEqual({
      plan: PlanName.ECOLE,
      maxAircraft: null,
      maxMembers: null,
    });
    expect(new PlanService({ get: () => undefined } as any).features).toEqual([
      PlanFeature.INSTRUCTION,
    ]);
  });

  it('reads the plan and its limits from the environment', () => {
    expect(
      parsePlanConfig({
        SKYCREW_PLAN: ' Club ',
        SKYCREW_MAX_AIRCRAFT: '3',
        SKYCREW_MAX_MEMBERS: '',
      }),
    ).toEqual({
      config: { plan: PlanName.CLUB, maxAircraft: 3, maxMembers: null },
      problems: [],
    });
  });

  it('reports a wrong value and falls back to the default instead of failing', () => {
    const { config, problems } = parsePlanConfig({
      SKYCREW_PLAN: 'premium',
      SKYCREW_MAX_AIRCRAFT: 'three',
      SKYCREW_MAX_MEMBERS: '0',
    });

    expect(config).toEqual(DEFAULT_PLAN);
    expect(problems).toHaveLength(3);
  });

  it('counts a place as free while fewer than the limit are used', () => {
    expect(hasRoomFor(2, 3)).toBe(true);
    expect(hasRoomFor(3, 3)).toBe(false);
    expect(hasRoomFor(5, 3)).toBe(false);
    expect(hasRoomFor(1000, null)).toBe(true);
  });

  it('refuses instruction in the Club plan, in French and English', () => {
    const club = PlanService.of({ plan: PlanName.CLUB });
    const ecole = PlanService.of({ plan: PlanName.ECOLE });

    expect(club.includes(PlanFeature.INSTRUCTION)).toBe(false);
    expect(keyOf(() => club.assertIncludes(PlanFeature.INSTRUCTION))).toBe(
      'error.plan.featureNotIncluded',
    );
    expect(keyOf(() => ecole.assertIncludes(PlanFeature.INSTRUCTION))).toBe(
      null,
    );
    expect(renderTranslation('fr', 'error.plan.featureNotIncluded')).toMatch(
      /formule Club \+ École/,
    );
    expect(renderTranslation('en', 'error.plan.featureNotIncluded')).toMatch(
      /Club \+ School plan/,
    );
  });

  it('refuses one aircraft or member too many and says how many the plan allows', () => {
    const plan = PlanService.of({ maxAircraft: 3, maxMembers: 40 });

    expect(keyOf(() => plan.assertRoomForAircraft(2))).toBe(null);
    let message = '';
    try {
      plan.assertRoomForAircraft(3);
    } catch (error) {
      message = error.message;
    }
    expect(message).toMatch(/^Votre formule permet 3 avion/);
    expect(keyOf(() => plan.assertRoomForMember(39))).toBe(null);
    expect(keyOf(() => plan.assertRoomForMember(40))).toBe(
      'error.plan.memberLimit',
    );
  });
});

describe('PlanFeatureGuard', () => {
  const contextFor = (target: object, handler: string) =>
    ({
      getClass: () => target,
      getHandler: () => (target as any).prototype[handler],
    }) as unknown as ExecutionContext;

  it('refuses a marked operation only when the plan leaves its feature out', () => {
    const reflector = new Reflector();
    const marked = contextFor(InstructionCoursesResolver, 'getAllCourses');
    const unmarked = contextFor(ReservationsResolver, 'createReservation');

    const club = new PlanFeatureGuard(
      reflector,
      PlanService.of({ plan: PlanName.CLUB }),
    );
    const ecole = new PlanFeatureGuard(
      reflector,
      PlanService.of({ plan: PlanName.ECOLE }),
    );

    expect(keyOf(() => club.canActivate(marked))).toBe(
      'error.plan.featureNotIncluded',
    );
    expect(club.canActivate(unmarked)).toBe(true);
    expect(ecole.canActivate(marked)).toBe(true);
  });

  it.each([
    InstructionCoursesResolver,
    CourseResolver,
    ModuleResolver,
    LessonResolver,
    EvaluationResolver,
    QuestionResolver,
    AnswerResolver,
    UserProgressResolver,
  ])('marks every operation of %p as instruction', (resolver) => {
    expect(Reflect.getMetadata(PLAN_FEATURE_KEY, resolver)).toBe(
      PlanFeature.INSTRUCTION,
    );
  });

  it('marks the instructor queries of bookings, not the licence check', () => {
    const marked = (handler: string) =>
      Reflect.getMetadata(
        PLAN_FEATURE_KEY,
        (ReservationsResolver.prototype as any)[handler],
      );

    expect(marked('getMyInstructionReservations')).toBe(
      PlanFeature.INSTRUCTION,
    );
    expect(marked('getBookableInstructors')).toBe(PlanFeature.INSTRUCTION);
    expect(marked('getMayBookWithoutInstructor')).toBeUndefined();
    expect(Reflect.getMetadata(PLAN_FEATURE_KEY, ReservationsResolver)).toBe(
      undefined,
    );
  });
});

describe('the plan query', () => {
  it('gives the plan, its limits, what is used and what is included', async () => {
    const manager = {
      count: jest
        .fn()
        .mockResolvedValueOnce(4) // aircraft in service
        .mockResolvedValueOnce(57), // active members
    };
    const resolver = new PlanResolver(
      PlanService.of({ plan: PlanName.CLUB, maxAircraft: 3 }),
      manager as any,
    );

    await expect(resolver.plan()).resolves.toEqual({
      plan: PlanName.CLUB,
      features: [],
      maxAircraft: 3,
      aircraftInService: 4,
      maxMembers: null,
      activeMembers: 57,
    });
  });
});
