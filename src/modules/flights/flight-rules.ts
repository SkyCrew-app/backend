// Business limits applied when a flight is recorded. Change them here.

// Longest flight a member can record in one go, in hours.
export const MAX_FLIGHT_HOURS = 24;

// Most flights returned by the "recent flights" list.
export const RECENT_FLIGHTS_MAX = 50;

// A flight with an instructor on board also counts in the instructor's own
// total of flight hours (they are in the aircraft), besides appearing in
// their logbook as instruction given.
export const INSTRUCTION_COUNTS_IN_INSTRUCTOR_TOTAL = true;

// How many flights a member's own list carries (newest first).
export const FLIGHTS_OF_MEMBER_LISTED = 200;
