import { translationOf } from '../../../common/i18n/localized-exception';
import { PlanService } from '../../../common/plan/plan.service';
import { PlanName } from '../../../common/plan/plan';
import { tables } from '../../../../test/support/fake-database';
import {
  bookingWorld,
  NOW,
  SLOT,
} from '../../../../test/support/booking-world';
import { assertAllowedToFly } from '../booking-rules';

const HOUR = 60 * 60 * 1000;
const refusal = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (caught) => caught,
  );
  return translationOf(error)?.key ?? error?.message ?? null;
};

// The plan of the club can be switched during a test, as when the owner
// changes the plan of an installation.
const switchablePlan = (initial: PlanName) => {
  let current = PlanService.of({ plan: initial });
  const plan = {
    get maxAircraft() {
      return current.maxAircraft;
    },
    get maxMembers() {
      return current.maxMembers;
    },
    includes: (feature) => current.includes(feature),
    assertIncludes: (feature) => current.assertIncludes(feature),
  } as PlanService;
  return {
    plan,
    switchTo: (name: PlanName) => (current = PlanService.of({ plan: name })),
  };
};

const VALID_LICENCE = {
  license_type: 'PPL',
  is_valid: true,
  status: 'active',
  expiration_date: new Date('2028-01-01T00:00:00Z'),
};

const clubWorld = (options: { licensed?: boolean; plan?: PlanName } = {}) => {
  const plan = switchablePlan(options.plan ?? PlanName.CLUB);
  const world = bookingWorld({ balance: 500, rate: 150, plan: plan.plan });
  const pilot = world.database.rows(tables.User)[0];
  if (options.licensed === false) pilot.licenses = [];
  const instructor = world.database.insert(tables.User, {
    first_name: 'Irene',
    last_name: 'Morel',
    email: 'irene@test.com',
    language: 'fr',
    is_active: true,
    user_account_balance: 0,
    role: { role_name: 'Instructeur' },
    licenses: [{ ...VALID_LICENCE }],
  });
  return { ...world, ...plan, pilot, instructor };
};

describe('Bookings in the Club plan (no instruction)', () => {
  it('refuses a booking with an instructor, and books nothing', async () => {
    const world = clubWorld();

    expect(
      await refusal(
        world.reservations.create(
          world.input({ instructor_id: world.instructor.id }),
          NOW,
        ),
      ),
    ).toBe('error.plan.featureNotIncluded');
    expect(world.database.rows(tables.Reservation)).toHaveLength(0);
    expect(world.balance()).toBe(500);
  });

  it('refuses a booking made for a course', async () => {
    const world = clubWorld();

    expect(
      await refusal(
        world.reservations.create(world.input({ course_id: 1 }), NOW),
      ),
    ).toBe('error.plan.featureNotIncluded');
  });

  it('still books a licensed pilot alone', async () => {
    const world = clubWorld();

    const booking = await world.reservations.create(
      world.input({ instructor_id: null }),
      NOW,
    );

    expect(booking.instructor).toBeNull();
  });

  it('tells a pilot without a licence that they cannot book, not to take an instructor', async () => {
    const world = clubWorld({ licensed: false });

    expect(await refusal(world.reservations.create(world.input(), NOW))).toBe(
      'error.reservation.licenceRequired',
    );
  });

  it('keeps the instructor of a booking made before the plan changed, but refuses adding one', async () => {
    const world = clubWorld({ plan: PlanName.ECOLE });
    const instructed = await world.reservations.create(
      world.input({ instructor_id: world.instructor.id }),
      NOW,
    );
    const solo = await world.reservations.create(
      world.input({
        instructor_id: null,
        start_time: new Date(SLOT.start_time.getTime() + 2 * HOUR),
        end_time: new Date(SLOT.end_time.getTime() + 2 * HOUR),
      }),
      NOW,
    );
    world.switchTo(PlanName.CLUB);

    const moved = await world.reservations.update(
      {
        id: instructed.id,
        start_time: new Date(SLOT.start_time.getTime() + 4 * HOUR),
        end_time: new Date(SLOT.end_time.getTime() + 4 * HOUR),
      } as any,
      NOW,
    );
    expect(moved.instructor).toMatchObject({ id: world.instructor.id });

    expect(
      await refusal(
        world.reservations.update(
          { id: solo.id, instructor_id: world.instructor.id } as any,
          NOW,
        ),
      ),
    ).toBe('error.plan.featureNotIncluded');
  });

  it('in the default plan, still sends a pilot without a licence to an instructor', async () => {
    const world = clubWorld({ licensed: false, plan: PlanName.ECOLE });

    expect(await refusal(world.reservations.create(world.input(), NOW))).toBe(
      'error.reservation.instructorRequired',
    );
  });
});

describe('assertAllowedToFly without instruction', () => {
  it('says a licence is required', () => {
    const fly = () =>
      assertAllowedToFly({
        pilotLicences: [],
        withInstructor: false,
        acceptedTypes: null,
        flightEnd: SLOT.end_time,
        instructionOffered: false,
      });

    expect(fly).toThrow();
    try {
      fly();
    } catch (error) {
      expect(translationOf(error)?.key).toBe(
        'error.reservation.licenceRequired',
      );
    }
  });
});
