import { FlightCategory } from '../reservations/entity/reservations.entity';

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

// The type of a flight is the category of its booking (local,
// cross-country, instruction…), whoever writes it: closing a flight,
// editing a plan, a plan made without a booking (local).
export const FLIGHT_TYPES: readonly string[] = Object.values(FlightCategory);
export const DEFAULT_FLIGHT_TYPE: string = FlightCategory.LOCAL;

// The category a submitted type stands for (case and spaces aside), or null
// when it is none of them.
export const flightTypeOf = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const type = value.trim().toLowerCase();
  return FLIGHT_TYPES.includes(type) ? type : null;
};

// How the documents printed by the API (logbook, flight summary: in French)
// name each type; a value from before the types were categories is printed
// as it is.
const FLIGHT_TYPE_LABELS: Record<FlightCategory, string> = {
  [FlightCategory.LOCAL]: 'Local',
  [FlightCategory.CROSS_COUNTRY]: 'Navigation',
  [FlightCategory.INSTRUCTION]: 'Instruction',
  [FlightCategory.TOURISM]: 'Tourisme',
  [FlightCategory.TRAINING]: 'Entraînement',
  [FlightCategory.MAINTENANCE]: 'Maintenance',
  [FlightCategory.PRIVATE]: 'Privé',
  [FlightCategory.CORPORATE]: 'Affaires',
};

export const flightTypeLabel = (value: string | null | undefined): string => {
  const type = flightTypeOf(value);
  return type ? FLIGHT_TYPE_LABELS[type as FlightCategory] : (value ?? '');
};
