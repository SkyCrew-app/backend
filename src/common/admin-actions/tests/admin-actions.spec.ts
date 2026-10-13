import { AdminActionsService } from '../admin-actions.service';
import { AdminActionsResolver } from '../admin-actions.resolver';
import {
  ADMIN_ACTION,
  ADMIN_ACTION_NAMES,
  ADMIN_ACTIONS_MAX_PAGE_SIZE,
  changedFields,
  sanitizeSummary,
} from '../admin-actions';
import { ROLES_KEY } from '../../decorators/roles.decorator';
import { AdminAction } from '../admin-action.entity';

describe('administrator actions trace', () => {
  let repository: { insert: jest.Mock; createQueryBuilder: jest.Mock };
  let query: Record<string, jest.Mock>;
  let service: AdminActionsService;

  beforeEach(() => {
    query = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 1 }], 41]),
    };
    repository = {
      insert: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn().mockReturnValue(query),
    };
    const moduleRef = {
      get: jest.fn().mockReturnValue({
        getRepository: (entity: unknown) =>
          entity === AdminAction ? repository : null,
      }),
    };
    service = new AdminActionsService(moduleRef as any);
  });

  describe('record', () => {
    it('adds a line saying who did what to what', async () => {
      await service.record(
        {
          id: 1,
          email: 'admin@club.fr',
          first_name: 'Anne',
          last_name: 'Martin',
        },
        ADMIN_ACTION.BALANCE_ADJUSTED,
        { type: 'member', id: 7, label: 'Jean Dupont' },
        { amount: 50, direction: 'credit' },
      );

      expect(repository.insert).toHaveBeenCalledWith({
        actor_id: 1,
        actor_label: 'Anne Martin',
        action: 'balance.adjusted',
        target_type: 'member',
        target_id: '7',
        target_label: 'Jean Dupont',
        summary: { amount: 50, direction: 'credit' },
      });
    });

    it('never writes a secret, whatever it is given', async () => {
      await service.record(
        { id: 1, email: 'admin@club.fr' },
        ADMIN_ACTION.SETTINGS_CHANGED,
        { type: 'settings', id: 1 },
        {
          password: 'hunter2',
          newPassword: 'x',
          validation_token: 'abc',
          twoFactorAuthSecret: 's',
          client_secret: 'pi_secret',
          nested: { passwordResetTokenHash: 'h', clubName: 'Aéroclub' },
          clubName: 'Aéroclub',
        },
      );

      expect(repository.insert.mock.calls[0][0].summary).toEqual({
        nested: { clubName: 'Aéroclub' },
        clubName: 'Aéroclub',
      });
      // Without a name, the administrator is named by their address.
      expect(repository.insert.mock.calls[0][0].actor_label).toBe(
        'admin@club.fr',
      );
    });

    it('does not undo the action when the line cannot be written', async () => {
      repository.insert.mockRejectedValue(new Error('database down'));

      await expect(
        service.record({ id: 1 }, ADMIN_ACTION.MEMBER_DELETED, {
          type: 'member',
          id: 3,
        }),
      ).resolves.toBeUndefined();
    });

    it('only ever inserts: the service has no way to change or remove a line', () => {
      const methods = Object.getOwnPropertyNames(AdminActionsService.prototype);
      expect(methods.sort()).toEqual([
        'actions',
        'constructor',
        'find',
        'record',
      ]);
    });
  });

  describe('find', () => {
    it('returns a page, newest first', async () => {
      const page = await service.find({ page: 2, pageSize: 20 });

      expect(page).toEqual({
        items: [{ id: 1 }],
        total: 41,
        page: 2,
        pageSize: 20,
      });
      expect(query.orderBy).toHaveBeenCalledWith('action.created_at', 'DESC');
      expect(query.skip).toHaveBeenCalledWith(20);
      expect(query.take).toHaveBeenCalledWith(20);
      expect(query.andWhere).not.toHaveBeenCalled();
    });

    it('filters by member (as actor or as target) and by action', async () => {
      await service.find({ memberId: 7, action: 'member.role_changed' });

      expect(query.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('action.actor_id = :memberId'),
        { memberId: 7, memberTarget: '7' },
      );
      // Lines about a payment, a booking or a flight of the member name
      // them in their summary.
      expect(query.andWhere).toHaveBeenCalledWith(
        expect.stringContaining(
          "action.summary ->> 'memberId' = :memberTarget",
        ),
        { memberId: 7, memberTarget: '7' },
      );
      expect(query.andWhere).toHaveBeenCalledWith('action.action = :name', {
        name: 'member.role_changed',
      });
    });

    it('bounds the page size', async () => {
      const page = await service.find({ page: -3, pageSize: 100000 });

      expect(page.page).toBe(1);
      expect(page.pageSize).toBe(ADMIN_ACTIONS_MAX_PAGE_SIZE);
    });
  });

  describe('helpers', () => {
    it('lists what changed, with the value before and after', () => {
      expect(
        changedFields(
          { clubName: 'A', fuelPrice: 2, closureDays: ['sunday'], kept: 1 },
          {
            clubName: 'B',
            fuelPrice: 2,
            closureDays: ['sunday', 'monday'],
            absent: undefined,
          },
        ),
      ).toEqual({
        clubName: { from: 'A', to: 'B' },
        closureDays: { from: ['sunday'], to: ['sunday', 'monday'] },
      });
    });

    // Saving the settings form sends every field back: only real changes
    // belong in the trace.
    it('does not report a field that only looks different', () => {
      expect(
        changedFields(
          {
            maintenanceMessage: null,
            taxonomies: { flightTypes: ['VFR'], categories: ['local'] },
            openedAt: new Date('2026-01-02T03:04:05Z'),
            contactPhone: '+33123456789',
          },
          {
            maintenanceMessage: '',
            taxonomies: { categories: ['local'], flightTypes: ['VFR'] },
            openedAt: '2026-01-02T03:04:05.000Z',
            contactPhone: '+33123456787',
          },
        ),
      ).toEqual({
        contactPhone: { from: '+33123456789', to: '+33123456787' },
      });
    });

    it('still reports a change inside a list or a nested value', () => {
      const changes = changedFields(
        { taxonomies: { flightTypes: ['VFR'] }, closureDays: ['sunday'] },
        {
          taxonomies: { flightTypes: ['VFR', 'IFR'] },
          closureDays: ['monday'],
        },
      );
      expect(Object.keys(changes)).toEqual(['taxonomies', 'closureDays']);
      // Kept whole in the stored summary, not flattened to nothing.
      expect(sanitizeSummary({ changes })).toEqual({
        changes: {
          taxonomies: {
            from: { flightTypes: ['VFR'] },
            to: { flightTypes: ['VFR', 'IFR'] },
          },
          closureDays: { from: ['sunday'], to: ['monday'] },
        },
      });
    });

    it('keeps a summary short and plain', () => {
      const summary = sanitizeSummary({
        when: new Date('2026-01-02T03:04:05Z'),
        text: 'x'.repeat(1000),
        fn: () => 1,
      });
      expect(summary.when).toBe('2026-01-02T03:04:05.000Z');
      expect((summary.text as string).length).toBeLessThanOrEqual(301);
      expect(summary.fn).toBeNull();
      expect(sanitizeSummary({ password: 'x' })).toBeNull();
    });
  });

  describe('reading', () => {
    it('is for administrators only', () => {
      for (const operation of ['adminActionsPage', 'adminActionNames']) {
        expect(
          Reflect.getMetadata(
            ROLES_KEY,
            AdminActionsResolver.prototype[operation],
          ),
        ).toEqual(['Administrateur']);
      }
    });

    it('passes the filters on and offers the known actions', async () => {
      const find = jest
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
      const resolver = new AdminActionsResolver({ find } as any);

      await resolver.adminActionsPage(7, 'member.deleted', 3, 10);

      expect(find).toHaveBeenCalledWith({
        memberId: 7,
        action: 'member.deleted',
        page: 3,
        pageSize: 10,
      });
      expect(resolver.adminActionNames()).toEqual(ADMIN_ACTION_NAMES);
      expect(ADMIN_ACTION_NAMES).toContain('settings.changed');
    });
  });
});
