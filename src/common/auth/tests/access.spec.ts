import { ForbiddenException } from '@nestjs/common';
import {
  assertSelfOrRole,
  hasRole,
  isAdmin,
  roleOf,
  ROLE_INSTRUCTOR,
} from '../access';

const pilot = { id: 3, email: 'p@example.com', role: { role_name: 'Pilote' } };
const instructor = {
  id: 4,
  email: 'i@example.com',
  role: { role_name: 'Instructeur' },
};
const admin = { id: 1, email: 'a@example.com', role: 'Administrateur' };

describe('access helpers', () => {
  it('reads the role from an object or a string', () => {
    expect(roleOf(pilot)).toBe('Pilote');
    expect(roleOf(admin)).toBe('Administrateur');
    expect(roleOf({ id: 9, email: 'x@example.com' })).toBeNull();
    expect(roleOf(undefined)).toBeNull();
  });

  it('checks roles', () => {
    expect(hasRole(instructor, ROLE_INSTRUCTOR)).toBe(true);
    expect(hasRole(pilot, ROLE_INSTRUCTOR)).toBe(false);
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(pilot)).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  describe('assertSelfOrRole', () => {
    it('lets a user act on their own data, whatever the id type', () => {
      expect(() => assertSelfOrRole(pilot, 3)).not.toThrow();
      expect(() => assertSelfOrRole(pilot, '3')).not.toThrow();
    });

    it('refuses a user acting on someone else', () => {
      expect(() => assertSelfOrRole(pilot, 4)).toThrow(ForbiddenException);
    });

    it('lets administrators and the listed roles through', () => {
      expect(() => assertSelfOrRole(admin, 4)).not.toThrow();
      expect(() =>
        assertSelfOrRole(instructor, 3, ROLE_INSTRUCTOR),
      ).not.toThrow();
      expect(() => assertSelfOrRole(instructor, 3)).toThrow(ForbiddenException);
    });

    it('refuses when there is no session or no target', () => {
      expect(() => assertSelfOrRole(undefined, 3)).toThrow(ForbiddenException);
      expect(() => assertSelfOrRole(pilot, undefined)).toThrow(
        ForbiddenException,
      );
    });
  });
});
