import { ForbiddenException } from '@nestjs/common';

export const ROLE_ADMIN = 'Administrateur';
export const ROLE_INSTRUCTOR = 'Instructeur';
export const ROLE_TECHNICIAN = 'Technicien';
export const ROLE_PILOT = 'Pilote';

// Shape of the authenticated user attached to the request by JwtStrategy.
export interface SessionUser {
  id: number;
  email: string;
  role?: { role_name: string } | string | null;
}

export const roleOf = (user: SessionUser | undefined | null): string | null => {
  if (!user?.role) {
    return null;
  }
  return typeof user.role === 'string' ? user.role : user.role.role_name;
};

export const hasRole = (
  user: SessionUser | undefined | null,
  ...roles: string[]
): boolean => {
  const role = roleOf(user);
  return role !== null && roles.includes(role);
};

export const isAdmin = (user: SessionUser | undefined | null): boolean =>
  hasRole(user, ROLE_ADMIN);

// The caller acts on their own data, or holds one of the given roles.
// Administrators always pass.
export const assertSelfOrRole = (
  user: SessionUser | undefined | null,
  targetUserId: number | string | undefined | null,
  ...roles: string[]
): void => {
  const isSelf =
    user != null &&
    targetUserId != null &&
    Number(targetUserId) === Number(user.id);

  if (isSelf || isAdmin(user) || hasRole(user, ...roles)) {
    return;
  }

  throw new ForbiddenException('You are not allowed to access this resource');
};
