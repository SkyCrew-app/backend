import { Reflector } from '@nestjs/core';
import { AdministrationResolver } from '../administration.resolver';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';

describe('Administration authorization', () => {
  const reflector = new Reflector();
  const rolesOf = (method: string) =>
    reflector.get<string[] | undefined>(
      ROLES_KEY,
      AdministrationResolver.prototype[method],
    );

  it('lets every member read the club settings', () => {
    expect(rolesOf('findAll')).toBeUndefined();
  });

  it.each(['create', 'update', 'delete', 'setSiteStatus'])(
    'keeps %s for administrators',
    (method) => {
      expect(rolesOf(method)).toEqual(['Administrateur']);
    },
  );
});
