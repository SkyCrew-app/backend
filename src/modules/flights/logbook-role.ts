import { registerEnumType } from '@nestjs/graphql';

// The part a member took in a flight of their logbook.
export enum LogbookRole {
  // Pilot of a flight without an instructor.
  PILOT_IN_COMMAND = 'PILOT_IN_COMMAND',
  // Pilot of a flight with an instructor on board: dual instruction time.
  DUAL = 'DUAL',
  // Instructor of the flight: instruction given.
  INSTRUCTOR = 'INSTRUCTOR',
}

registerEnumType(LogbookRole, { name: 'LogbookRole' });

export const logbookRoleOf = (
  flight: {
    user?: { id?: number | string } | null;
    instructor?: { id?: number | string } | null;
  },
  memberId: number,
): LogbookRole => {
  if (
    flight.instructor?.id != null &&
    Number(flight.instructor.id) === Number(memberId)
  ) {
    return LogbookRole.INSTRUCTOR;
  }
  return flight.instructor?.id != null
    ? LogbookRole.DUAL
    : LogbookRole.PILOT_IN_COMMAND;
};
