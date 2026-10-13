import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersResolver, UserProgressResolver } from '../users.resolver';
import { UsersService } from '../users.service';
import { EvalService } from '../../eval/eval.service';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { GqlThrottlerGuard } from '../../../common/guards/gql-throttler.guard';

const pilot = {
  id: 3,
  email: 'pilot@example.com',
  role: { role_name: 'Pilote' },
} as any;
const instructor = {
  id: 4,
  email: 'instructor@example.com',
  role: { role_name: 'Instructeur' },
} as any;
const admin = {
  id: 1,
  email: 'admin@example.com',
  role: { role_name: 'Administrateur' },
} as any;

const otherUser = {
  id: 7,
  first_name: 'Marie',
  last_name: 'Laurent',
  email: 'marie@example.com',
  phone_number: '0600000000',
  profile_picture: '/uploads/users/7/photo.png',
  address: '1 rue du Hangar',
  date_of_birth: new Date('1990-01-01'),
  user_account_balance: 420,
  is2FAEnabled: true,
};

describe('Users authorization', () => {
  let users: UsersResolver;
  let progress: UserProgressResolver;
  let usersService: Record<string, jest.Mock>;
  let evalService: Record<string, jest.Mock>;

  beforeEach(async () => {
    usersService = {
      findOneByEmail: jest.fn().mockResolvedValue(otherUser),
      findOneById: jest.fn().mockResolvedValue(otherUser),
      updateUser: jest.fn().mockResolvedValue({}),
      getUserPreferences: jest.fn().mockResolvedValue({}),
      updateUserPreferences: jest.fn().mockResolvedValue({}),
      updateDashboardWidgets: jest.fn().mockResolvedValue({}),
      getCourseProgress: jest.fn().mockResolvedValue(50),
      markLessonStarted: jest.fn(),
      markLessonCompleted: jest.fn(),
      getEvaluationResults: jest.fn().mockResolvedValue([]),
      getUserProgress: jest.fn().mockResolvedValue(true),
      // By default the instructor has no course with the member read.
      isInstructorOf: jest.fn().mockResolvedValue(false),
      setActive: jest.fn().mockResolvedValue({}),
      remove: jest.fn().mockResolvedValue(true),
      resendInvitation: jest.fn().mockResolvedValue(true),
    };
    evalService = { getUserEvaluationResults: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersResolver,
        UserProgressResolver,
        { provide: UsersService, useValue: usersService },
        { provide: EvalService, useValue: evalService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(GqlThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    users = module.get(UsersResolver);
    progress = module.get(UserProgressResolver);
  });

  describe('profile of another member', () => {
    it('shows a member only the directory entry', async () => {
      const result = await users.userByEmail('marie@example.com', pilot);

      expect(result).toEqual({
        id: 7,
        first_name: 'Marie',
        last_name: 'Laurent',
        email: 'marie@example.com',
        phone_number: '0600000000',
        profile_picture: '/uploads/users/7/photo.png',
      });
      expect(await users.getUserDetails(7, pilot)).toEqual(result);
    });

    it.each([
      ['an instructor', instructor],
      ['an administrator', admin],
      ['the user themselves', { ...pilot, id: 7 }],
    ])('shows the full profile to %s', async (_label, caller) => {
      expect(await users.userByEmail('marie@example.com', caller)).toBe(
        otherUser,
      );
    });
  });

  describe('updateUser', () => {
    it('refuses a member targeting another account', async () => {
      await expect(
        users.updateUser(
          { email: 'marie@example.com', first_name: 'X' },
          undefined,
          pilot,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(usersService.updateUser).not.toHaveBeenCalled();
    });

    it('updates the session account when no email is given', async () => {
      await users.updateUser({ first_name: 'X' }, undefined, pilot);

      expect(usersService.updateUser).toHaveBeenCalledWith(
        'pilot@example.com',
        { first_name: 'X' },
        null,
        { asAdmin: false },
      );
    });

    it('lets an administrator update another account', async () => {
      await users.updateUser(
        { email: 'marie@example.com', roleId: 2 },
        undefined,
        admin,
      );

      expect(usersService.updateUser).toHaveBeenCalledWith(
        'marie@example.com',
        { email: 'marie@example.com', roleId: 2 },
        null,
        { asAdmin: true },
      );
    });
  });

  describe('operations on a given user id', () => {
    const writes: Array<[string, (caller: any) => Promise<unknown>]> = [
      [
        'updateUserPreferences',
        (caller) => users.updateUserPreferences(7, {} as any, caller),
      ],
      [
        'updateDashboardWidgets',
        (caller) => users.updateDashboardWidgets(7, [], caller),
      ],
      ['getUserPreferences', (caller) => users.getUserPreferences(7, caller)],
      [
        'markLessonStarted',
        (caller) => progress.markLessonStarted(7, 1, caller),
      ],
      [
        'markLessonCompleted',
        (caller) => progress.markLessonCompleted(7, 1, caller),
      ],
    ];

    it.each(writes)('%s refuses another member', async (_name, call) => {
      await expect(call(pilot)).rejects.toThrow(ForbiddenException);
    });

    it.each(writes)('%s refuses an instructor', async (_name, call) => {
      await expect(call(instructor)).rejects.toThrow(ForbiddenException);
    });

    it.each(writes)('%s accepts the user themselves', async (_name, call) => {
      await expect(call({ ...pilot, id: 7 })).resolves.toBeDefined();
    });

    const progressReads: Array<[string, (caller: any) => Promise<unknown>]> = [
      [
        'getUserProgressByEvaluation',
        (caller) => progress.getUserProgressByEvaluation(7, caller),
      ],
      [
        'getCourseProgress',
        (caller) => progress.getCourseProgress(7, 1, caller),
      ],
      [
        'getUserEvaluationResults',
        (caller) => progress.getUserEvaluationResults(7, caller),
      ],
      ['getUserProgress', (caller) => progress.getUserProgress(7, 1, caller)],
    ];

    it.each(progressReads)('%s refuses another member', async (_name, call) => {
      await expect(call(pilot)).rejects.toThrow(ForbiddenException);
    });

    // Rewritten: any instructor used to read the progress of every member.
    it.each(progressReads)(
      '%s refuses an instructor who does not teach this member',
      async (_name, call) => {
        await expect(call(instructor)).rejects.toThrow(ForbiddenException);
        expect(usersService.isInstructorOf).toHaveBeenCalledWith(4, 7);
      },
    );

    it.each(progressReads)(
      '%s accepts the instructor of this member',
      async (_name, call) => {
        usersService.isInstructorOf.mockResolvedValue(true);
        await expect(call(instructor)).resolves.toBeDefined();
      },
    );

    it.each(progressReads)(
      '%s accepts the member and an administrator',
      async (_name, call) => {
        await expect(call({ ...pilot, id: 7 })).resolves.toBeDefined();
        await expect(call(admin)).resolves.toBeDefined();
      },
    );
  });

  describe('member accounts', () => {
    const adminOnly: Array<[string, keyof UsersResolver]> = [
      ['getUsers', 'getUsers'],
      ['createUser', 'createUser'],
      ['setUserActive', 'setUserActive'],
      ['deleteUser', 'deleteUser'],
      ['resendInvitation', 'resendInvitation'],
    ];

    it.each(adminOnly)('%s is for administrators only', (_name, method) => {
      expect(
        Reflect.getMetadata('roles', UsersResolver.prototype[method]),
      ).toEqual(['Administrateur']);
      expect(
        Reflect.getMetadata('__guards__', UsersResolver.prototype[method]),
      ).toContain(RolesGuard);
    });

    it('leaves deactivated members out of the directory', async () => {
      usersService.findAll = jest.fn().mockResolvedValue([
        { ...otherUser, id: 7, is_active: true },
        { ...otherUser, id: 8, is_active: false },
      ]);

      const directory = await users.membersDirectory();

      expect(directory.map((member) => member.id)).toEqual([7]);
    });

    it('accepts the own address typed in another case', async () => {
      await users.updateUser(
        { email: 'Pilot@Example.com', first_name: 'X' },
        undefined,
        pilot,
      );

      expect(usersService.updateUser).toHaveBeenCalled();
    });
  });
});
