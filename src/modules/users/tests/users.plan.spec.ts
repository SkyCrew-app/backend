import { translationOf } from '../../../common/i18n/localized-exception';
import { PlanService } from '../../../common/plan/plan.service';
import { PlanName } from '../../../common/plan/plan';
import { UsersService } from '../users.service';
import { User } from '../entity/users.entity';

const refusal = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (caught) => caught,
  );
  return translationOf(error)?.key ?? error?.message ?? null;
};

const ROLES = {
  2: { id: 2, role_name: 'Pilote' },
  3: { id: 3, role_name: 'Instructeur' },
};

// A club with `active` active members, under the given plan.
const club = (active: number, plan: Parameters<typeof PlanService.of>[0]) => {
  const stored = new Map<number, any>();
  const repository = {
    manager: {
      count: jest.fn().mockResolvedValue(active),
      getRepository: () => ({
        findOne: jest.fn(
          async ({ where }) =>
            Object.values(ROLES).find(
              (role) =>
                role.id === where.id || role.role_name === where.role_name,
            ) ?? null,
        ),
      }),
    },
    findOne: jest.fn(async ({ where }) => stored.get(where?.id) ?? null),
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(async (user) => user),
    count: jest.fn().mockResolvedValue(1),
  };
  const mailer = { sendMail: jest.fn().mockResolvedValue(true) };
  const service = new UsersService(
    repository as any,
    mailer as any,
    {} as any,
    {} as any,
    { create: jest.fn() } as any,
    PlanService.of(plan),
  );
  const invite = (roleId?: number) =>
    service.create(
      {
        first_name: 'Nina',
        last_name: 'Petit',
        email: 'nina@club.test',
        date_of_birth: new Date('2000-01-01'),
      },
      roleId,
    );
  return { service, repository, mailer, stored, invite };
};

describe('The member limit of the plan', () => {
  it('invites a member while places are left', async () => {
    const world = club(39, { maxMembers: 40 });

    await world.invite();

    expect(world.repository.save).toHaveBeenCalled();
    expect(world.mailer.sendMail).toHaveBeenCalled();
  });

  it('refuses an invitation once every place is used, and sends nothing', async () => {
    const world = club(40, { maxMembers: 40 });

    expect(await refusal(world.invite())).toBe('error.plan.memberLimit');
    expect(world.repository.save).not.toHaveBeenCalled();
    expect(world.mailer.sendMail).not.toHaveBeenCalled();
  });

  it('refuses reactivating a member once every place is used, never deactivating one', async () => {
    const world = club(40, { maxMembers: 40 });
    world.stored.set(7, {
      id: 7,
      is_active: false,
      role: ROLES[2],
    } as unknown as User);
    world.stored.set(8, {
      id: 8,
      is_active: true,
      isEmailConfirmed: true,
      role: ROLES[2],
    } as unknown as User);

    expect(await refusal(world.service.setActive(7, true))).toBe(
      'error.plan.memberLimit',
    );
    await expect(world.service.setActive(8, false)).resolves.toMatchObject({
      is_active: false,
    });
  });

  it('counts nothing when the plan has no member limit', async () => {
    const world = club(5000, {});

    await world.invite();

    expect(world.repository.manager.count).not.toHaveBeenCalled();
  });
});

describe('The instructor role in the Club plan', () => {
  it('cannot be given to a new member', async () => {
    const world = club(1, { plan: PlanName.CLUB });

    expect(await refusal(world.invite(3))).toBe(
      'error.plan.featureNotIncluded',
    );
    expect(world.mailer.sendMail).not.toHaveBeenCalled();
    await world.invite(2);
    expect(world.repository.save).toHaveBeenCalledTimes(1);
  });

  it('cannot be given to an existing member', async () => {
    const world = club(1, { plan: PlanName.CLUB });
    world.repository.findOne.mockResolvedValue({
      id: 7,
      email: 'nina@club.test',
      is_active: true,
      role: ROLES[2],
    });

    expect(
      await refusal(
        world.service.updateUser('nina@club.test', { roleId: 3 } as any, null, {
          asAdmin: true,
        }),
      ),
    ).toBe('error.plan.featureNotIncluded');
    expect(world.repository.save).not.toHaveBeenCalled();
  });

  it('can be given in the Club + École plan', async () => {
    const world = club(1, { plan: PlanName.ECOLE });

    await world.invite(3);

    expect(world.repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: ROLES[3] }),
    );
  });
});
