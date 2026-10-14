import { EntityManager, Not } from 'typeorm';
import {
  Aircraft,
  AvailabilityStatus,
} from '../../modules/aircraft/entity/aircraft.entity';
import { User } from '../../modules/users/entity/users.entity';

// OWNER DECISION — what uses a place in the plan.
// An aircraft counts while it is in service, that is while its stored
// availability is not "unavailable": an aircraft retired (kept for its
// history) or grounded by hand does not count, one only held by a
// maintenance does (its stored status does not change). Putting an
// aircraft back in service takes a place again.
export const usesAircraftPlace = (
  status: AvailabilityStatus | string | null | undefined,
): boolean => status !== AvailabilityStatus.UNAVAILABLE;

export const countAircraftInService = (
  manager: EntityManager,
): Promise<number> =>
  manager.count(Aircraft, {
    where: { availability_status: Not(AvailabilityStatus.UNAVAILABLE) },
  });

// A member counts while their account is active, invitation pending or not.
// A deactivated member (who left the club) does not.
export const countActiveMembers = (manager: EntityManager): Promise<number> =>
  manager.count(User, { where: { is_active: true } });
