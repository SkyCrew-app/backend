import { ForbiddenException } from '@nestjs/common';
import { LicensesService } from '../licenses.service';
import { LicensesResolver } from '../licenses.resolver';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { ADMIN_ACTION } from '../../../common/admin-actions/admin-actions';
import { translationOf } from '../../../common/i18n/localized-exception';

// A member enters and corrects their own licences; an administrator
// validates them.
describe('licences entered by members', () => {
  const future = new Date(Date.now() + 365 * 86400_000);
  let rows: any[];
  let service: LicensesService;
  let record: jest.Mock;
  let resolver: LicensesResolver;

  beforeEach(() => {
    rows = [
      {
        id: 1,
        license_type: 'PPL',
        license_number: 'PPL-1',
        status: 'active',
        is_valid: true,
        expiration_date: future,
        user: { id: 7 },
      },
    ];
    const repository = {
      find: jest.fn(async ({ where }) =>
        rows.filter(
          (row) =>
            (!where.license_type || row.license_type === where.license_type) &&
            (!where.user || row.user.id === where.user.id),
        ),
      ),
      findOne: jest.fn(
        async ({ where }) => rows.find((row) => row.id === where.id) ?? null,
      ),
      create: jest.fn((row) => ({ ...row })),
      save: jest.fn(async (row) => {
        if (!row.id) {
          row.id = rows.length + 1;
          rows.push(row);
        }
        return row;
      }),
    };
    service = new LicensesService(
      repository as any,
      {
        findOneById: jest.fn(async (id: number) => ({ id })),
      } as any,
    );
    record = jest.fn();
    resolver = new LicensesResolver(service, { record } as any);
  });

  const member = { id: 7, email: 'jean@club.fr', role: 'Pilote' };
  const admin = { id: 1, email: 'admin@club.fr', role: 'Administrateur' };

  it('adds a licence for the member signed in, pending and not valid', async () => {
    const added = await resolver.addMyLicense(
      {
        license_type: 'LAPL',
        license_number: ' LAPL-9 ',
        issue_date: new Date('2025-01-01'),
        expiration_date: future,
      },
      undefined,
      member,
    );

    expect(added).toMatchObject({
      user: { id: 7 },
      license_number: 'LAPL-9',
      status: 'pending',
      is_valid: false,
    });
    expect((await resolver.myLicenses(member)).map((l) => l.id)).toEqual([
      1, 2,
    ]);
  });

  it('puts an active licence back to pending when its holder changes it', async () => {
    const changed = await resolver.updateMyLicense(
      { id: 1, license_number: 'PPL-1-B' },
      undefined,
      member,
    );

    expect(changed).toMatchObject({
      license_number: 'PPL-1-B',
      status: 'pending',
      is_valid: false,
    });
  });

  it("refuses a change to someone else's licence", async () => {
    const refusal = await resolver
      .updateMyLicense({ id: 1, license_number: 'X' }, undefined, {
        ...member,
        id: 8,
      })
      .catch((error) => error);

    expect(refusal).toBeInstanceOf(ForbiddenException);
    expect(translationOf(refusal)?.key).toBe('error.licence.notYours');
    expect(rows[0].license_number).toBe('PPL-1');
  });

  it('lets an administrator validate it, and traces it', async () => {
    rows[0].status = 'pending';
    rows[0].is_valid = false;

    const validated = await resolver.validateLicense(1, admin);

    expect(validated).toMatchObject({ status: 'active', is_valid: true });
    expect(record).toHaveBeenCalledWith(
      admin,
      ADMIN_ACTION.LICENCE_VALIDATED,
      expect.objectContaining({ type: 'licence', id: 1 }),
      { memberId: '7', from: 'pending', to: 'active' },
    );
  });

  it('keeps validation and deletion for administrators only', () => {
    const roles = (name: keyof LicensesResolver) =>
      Reflect.getMetadata(ROLES_KEY, LicensesResolver.prototype[name]);
    expect(roles('validateLicense')).toEqual(['Administrateur']);
    expect(roles('deleteLicense')).toEqual(['Administrateur']);
    expect(roles('createLicense')).toEqual(['Administrateur']);
    expect(roles('addMyLicense')).toBeUndefined();
    expect(roles('updateMyLicense')).toBeUndefined();
  });
});
