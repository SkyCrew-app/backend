import { FieldMiddleware } from '@nestjs/graphql';
import {
  hasRole,
  isAdmin,
  ROLE_INSTRUCTOR,
  SessionUser,
} from '../../common/auth/access';

// Who reads what on a member, whatever the query that led to them (the pilot
// of a booking, the technician of a maintenance, the author of an incident…).
//
// Fields carrying no middleware are the directory entry every member sees:
// name, e-mail, phone, picture, role, and the bookings shown on the planning.
// Every other field of the User type carries one of the two rules below and
// resolves to null for anyone else, without failing the query.

// The rest of the profile: the member, instructors and administrators.
const PROFILE_READER_ROLES = [ROLE_INSTRUCTOR];

// Money, security and personal settings: the member and administrators only.
const PRIVATE_READER_ROLES: string[] = [];

const readableBy =
  (roles: string[]): FieldMiddleware =>
  async (ctx, next) => {
    const requester: SessionUser | undefined = ctx.context?.req?.user;
    const memberId = ctx.source?.id;
    const isSelf =
      requester != null &&
      memberId != null &&
      Number(requester.id) === Number(memberId);

    if (isSelf || isAdmin(requester) || hasRole(requester, ...roles)) {
      return next();
    }
    return null;
  };

export const profileField = readableBy(PROFILE_READER_ROLES);
export const privateField = readableBy(PRIVATE_READER_ROLES);
