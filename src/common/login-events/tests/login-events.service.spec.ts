import { LoginEventsService } from '../login-events.service';
import { LoginEventsResolver } from '../login-events.resolver';
import { LoginEvent } from '../login-event.entity';
import {
  attemptedEmailOf,
  LOGIN_EVENTS_MAX_PAGE_SIZE,
  LOGIN_EVENTS_RETENTION_MONTHS,
  LoginDeviceType,
  LoginMethod,
  LoginOutcome,
  MAX_ATTEMPTED_EMAIL_LENGTH,
  MY_LOGIN_EVENTS_LIMIT,
} from '../login-events';
import { User } from '../../../modules/users/entity/users.entity';
import { ROLES_KEY } from '../../decorators/roles.decorator';

describe('connection log', () => {
  let events: Record<string, jest.Mock>;
  let users: Record<string, jest.Mock>;
  let query: Record<string, jest.Mock>;
  let userLookup: Record<string, jest.Mock>;
  let purge: Record<string, jest.Mock>;
  let service: LoginEventsService;

  const visitor = {
    ip: '::ffff:203.0.113.7',
    headers: {
      'user-agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      cookie: 'token=session-cookie',
      authorization: 'Bearer abc',
    },
  };

  beforeEach(() => {
    query = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          { id: 2, user_id: 7 },
          { id: 1, user_id: null, attempted_email: 'x@y.fr' },
        ],
        2,
      ]),
    };
    purge = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 4 }),
    };
    events = {
      insert: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([{ id: 1 }]),
      createQueryBuilder: jest.fn((alias?: string) => (alias ? query : purge)),
    };
    userLookup = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 7 }),
    };
    users = {
      update: jest.fn().mockResolvedValue({}),
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 7, first_name: 'Anne', last_name: 'Martin', email: 'a@b.fr' },
        ]),
      createQueryBuilder: jest.fn().mockReturnValue(userLookup),
    };
    const dataSource = {
      getRepository: (entity: unknown) =>
        entity === LoginEvent ? events : entity === User ? users : null,
    };
    service = new LoginEventsService({
      get: jest.fn().mockReturnValue(dataSource),
    } as any);
  });

  const written = () => events.insert.mock.calls[0][0];

  describe('record', () => {
    it('writes who, how, from where and with what device', async () => {
      await service.record({
        outcome: LoginOutcome.SUCCESS,
        method: LoginMethod.PASSWORD,
        userId: 7,
        email: 'anne@club.fr',
        req: visitor,
      });

      expect(written()).toEqual({
        user_id: 7,
        // The account is known: the address is not kept.
        attempted_email: null,
        outcome: 'success',
        method: 'password',
        ip_address: '203.0.113.7',
        browser: 'Safari 18',
        os: 'iOS',
        device_type: LoginDeviceType.MOBILE,
        user_agent: visitor.headers['user-agent'],
      });
    });

    it('keeps no secret: no cookie, no header other than the user agent', async () => {
      await service.record({
        outcome: LoginOutcome.WRONG_PASSWORD,
        method: LoginMethod.PASSWORD,
        userId: 7,
        req: visitor,
        // Whatever a caller passes besides, it is not written.
        ...({ password: 'hunter2', token: 'jwt' } as object),
      } as any);

      const line = JSON.stringify(written());
      for (const secret of ['hunter2', 'jwt', 'session-cookie', 'Bearer']) {
        expect(line).not.toContain(secret);
      }
      expect(Object.keys(written()).sort()).toEqual(
        [
          'attempted_email',
          'browser',
          'device_type',
          'ip_address',
          'method',
          'os',
          'outcome',
          'user_agent',
          'user_id',
        ].sort(),
      );
    });

    it('keeps the address typed when it matches no account, lower case and short', async () => {
      const long = `${'A'.repeat(200)}@Club.FR`;
      await service.record({
        outcome: LoginOutcome.UNKNOWN_ACCOUNT,
        method: LoginMethod.PASSWORD,
        userId: null,
        email: `  ${long} `,
        req: visitor,
      });

      expect(written().user_id).toBeNull();
      expect(written().attempted_email).toBe(
        long.toLowerCase().slice(0, MAX_ATTEMPTED_EMAIL_LENGTH),
      );
    });

    it('does not keep what is not an address (a password typed in the wrong field)', () => {
      expect(attemptedEmailOf('MonMotDePasse!')).toBeNull();
      expect(attemptedEmailOf('mot de passe@x')).toBeNull();
      expect(attemptedEmailOf('')).toBeNull();
      expect(attemptedEmailOf(' Jean@Club.fr ')).toBe('jean@club.fr');
    });

    it('finds the account from the address when the caller does not know it', async () => {
      await service.recordThrottled({
        method: LoginMethod.PASSWORD,
        email: 'Anne@Club.fr',
        req: visitor,
      });

      expect(userLookup.where).toHaveBeenCalledWith(
        'LOWER(user.email) = LOWER(:email)',
        { email: 'Anne@Club.fr' },
      );
      expect(written()).toMatchObject({
        user_id: 7,
        attempted_email: null,
        outcome: 'locked_or_throttled',
      });
    });

    it('notes the date of the last sign-in on the member, on a success only', async () => {
      await service.record({ outcome: LoginOutcome.WRONG_PASSWORD, userId: 7 });
      await service.record({
        outcome: LoginOutcome.SECOND_FACTOR_REQUIRED,
        userId: 7,
      });
      expect(users.update).not.toHaveBeenCalled();

      await service.record({ outcome: LoginOutcome.SUCCESS, userId: 7 });
      expect(users.update).toHaveBeenCalledWith(
        { id: 7 },
        { lastSignInAt: expect.any(Date) },
      );
    });

    it('never throws, so the sign-in goes on when the log cannot be written', async () => {
      events.insert.mockRejectedValue(new Error('database down'));
      await expect(
        service.record({ outcome: LoginOutcome.SUCCESS, userId: 7 }),
      ).resolves.toBeUndefined();

      events.insert.mockResolvedValue({});
      users.update.mockRejectedValue(new Error('locked'));
      await expect(
        service.record({ outcome: LoginOutcome.SUCCESS, userId: 7 }),
      ).resolves.toBeUndefined();
    });

    it('works without a request (no address, unknown device)', async () => {
      await service.record({ outcome: LoginOutcome.LOGOUT, userId: 7 });
      expect(written()).toMatchObject({
        ip_address: null,
        browser: null,
        os: null,
        device_type: 'unknown',
        user_agent: null,
      });
    });

    it('writes one line a minute for a burst of refused attempts', async () => {
      const attempt = {
        method: LoginMethod.PASSWORD,
        email: 'anne@club.fr',
        req: visitor,
      };
      await service.recordThrottled(attempt);
      await service.recordThrottled(attempt);
      await service.recordThrottled(attempt);
      expect(events.insert).toHaveBeenCalledTimes(1);

      // Another account, or another address, is another line.
      await service.recordThrottled({ ...attempt, email: 'jean@club.fr' });
      await service.recordThrottled({
        ...attempt,
        req: { ...visitor, ip: '198.51.100.1' },
      });
      expect(events.insert).toHaveBeenCalledTimes(3);
    });

    it('only ever inserts: the service has no way to change a line', () => {
      const methods = Object.getOwnPropertyNames(
        LoginEventsService.prototype,
      ).sort();
      expect(methods).toEqual(
        [
          'constructor',
          'dataSource',
          'events',
          'find',
          'forMember',
          'purgeExpired',
          'record',
          'recordThrottled',
          'userIdOf',
          'withMemberNames',
        ].sort(),
      );
    });
  });

  describe('reading', () => {
    it('returns a page, newest first, with the name of each member', async () => {
      const page = await service.find({ page: 2, pageSize: 10 });

      expect(query.orderBy).toHaveBeenCalledWith('event.created_at', 'DESC');
      expect(query.skip).toHaveBeenCalledWith(10);
      expect(query.take).toHaveBeenCalledWith(10);
      expect(query.andWhere).not.toHaveBeenCalled();
      expect(page.total).toBe(2);
      expect(page.items[0]).toMatchObject({ member_name: 'Anne Martin' });
      expect(page.items[1]).toMatchObject({
        member_name: null,
        attempted_email: 'x@y.fr',
      });
    });

    it('filters by member, outcome and period', async () => {
      const from = new Date('2026-10-01T00:00:00Z');
      const to = new Date('2026-10-08T00:00:00Z');
      await service.find({
        memberId: 7,
        outcome: LoginOutcome.WRONG_PASSWORD,
        from,
        to,
      });

      expect(query.andWhere).toHaveBeenCalledWith('event.user_id = :memberId', {
        memberId: 7,
      });
      expect(query.andWhere).toHaveBeenCalledWith('event.outcome = :outcome', {
        outcome: 'wrong_password',
      });
      expect(query.andWhere).toHaveBeenCalledWith('event.created_at >= :from', {
        from,
      });
      expect(query.andWhere).toHaveBeenCalledWith('event.created_at < :to', {
        to,
      });
    });

    it('ignores a date that is not one and bounds the page size', async () => {
      const page = await service.find({
        from: new Date('nonsense'),
        page: -1,
        pageSize: 100000,
      });
      expect(query.andWhere).not.toHaveBeenCalled();
      expect(page.page).toBe(1);
      expect(page.pageSize).toBe(LOGIN_EVENTS_MAX_PAGE_SIZE);
    });

    it('gives a member the latest lines of their own account', async () => {
      await service.forMember(7);
      expect(events.find).toHaveBeenCalledWith({
        where: { user_id: 7 },
        order: { created_at: 'DESC', id: 'DESC' },
        take: MY_LOGIN_EVENTS_LIMIT,
      });
      expect(MY_LOGIN_EVENTS_LIMIT).toBe(20);
    });
  });

  describe('retention', () => {
    it('removes only the lines older than six months', async () => {
      await expect(service.purgeExpired()).resolves.toBe(4);
      expect(LOGIN_EVENTS_RETENTION_MONTHS).toBe(6);
      expect(purge.where).toHaveBeenCalledWith(
        'created_at < now() - make_interval(months => :months)',
        { months: 6 },
      );
    });
  });

  describe('permissions', () => {
    it('gives the whole log to administrators only', () => {
      expect(
        Reflect.getMetadata(
          ROLES_KEY,
          LoginEventsResolver.prototype.loginEventsPage,
        ),
      ).toEqual(['Administrateur']);
    });

    it("gives a member their own lines, whatever role they hold, and nobody else's", async () => {
      const forMember = jest.fn().mockResolvedValue([]);
      const resolver = new LoginEventsResolver({ forMember } as any);

      expect(
        Reflect.getMetadata(
          ROLES_KEY,
          LoginEventsResolver.prototype.myLoginEvents,
        ),
      ).toBeUndefined();
      // The operation takes no member argument: only the session says who.
      expect(LoginEventsResolver.prototype.myLoginEvents.length).toBe(1);

      await resolver.myLoginEvents({ id: 9, email: 'pilote@club.fr' });
      expect(forMember).toHaveBeenCalledWith(9);
      await expect(resolver.myLoginEvents(undefined)).rejects.toThrow();
    });

    it('passes the filters of an administrator on', async () => {
      const find = jest.fn().mockResolvedValue({});
      const resolver = new LoginEventsResolver({ find } as any);
      const from = new Date('2026-10-01');
      await resolver.loginEventsPage(
        3,
        10,
        7,
        LoginOutcome.UNKNOWN_ACCOUNT,
        from,
        undefined,
      );
      expect(find).toHaveBeenCalledWith({
        page: 3,
        pageSize: 10,
        memberId: 7,
        outcome: 'unknown_account',
        from,
        to: undefined,
      });
    });
  });
});
