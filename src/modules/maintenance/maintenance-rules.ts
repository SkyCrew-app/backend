// Rules shared by everything that needs to know whether a maintenance keeps
// an aircraft on the ground.

// What happens when a maintenance is planned over existing bookings:
// 'refuse' tells the planner which bookings are in the way and saves nothing,
// 'allow' saves the maintenance and leaves the bookings as they are.
export const MAINTENANCE_OVER_BOOKINGS: 'refuse' | 'allow' = 'refuse';

export const MAINTENANCE_IN_PROGRESS = 'IN_PROGRESS';
export const MAINTENANCE_COMPLETED = 'COMPLETED';
export const MAINTENANCE_CANCELLED = 'CANCELLED';

// What the aircraft shows while a maintenance holds it.
export const AIRCRAFT_IN_MAINTENANCE = 'En maintenance';

interface MaintenanceWindow {
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  status?: string | null;
}

const statusOf = (maintenance: MaintenanceWindow): string =>
  (maintenance.status ?? '').trim().toUpperCase();

// A finished or cancelled maintenance no longer takes the aircraft.
export const occupiesAircraft = (maintenance: MaintenanceWindow): boolean =>
  ![MAINTENANCE_COMPLETED, MAINTENANCE_CANCELLED].includes(
    statusOf(maintenance),
  );

// A maintenance is planned by day (the form picks dates, the lists show
// "until the 16th"): the aircraft is held through the last day, that is until
// this long after the stored end.
export const MAINTENANCE_END_DAY_HOURS = 24;

// The period during which a maintenance holds its aircraft, or null when its
// dates are missing.
export const maintenanceWindow = (
  maintenance: MaintenanceWindow,
): { start: Date; end: Date } | null => {
  if (!maintenance.start_date || !maintenance.end_date) {
    return null;
  }
  const start = new Date(maintenance.start_date);
  const end = new Date(
    new Date(maintenance.end_date).getTime() +
      MAINTENANCE_END_DAY_HOURS * 3_600_000,
  );
  return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
    ? null
    : { start, end };
};

// Whether the maintenance keeps the aircraft on the ground at that moment:
// it is in progress, or it is planned and its period covers the moment.
export const groundsAircraftAt = (
  maintenance: MaintenanceWindow,
  moment: Date = new Date(),
): boolean => {
  if (!occupiesAircraft(maintenance)) {
    return false;
  }
  if (statusOf(maintenance) === MAINTENANCE_IN_PROGRESS) {
    return true;
  }
  const window = maintenanceWindow(maintenance);
  const time = moment.getTime();
  return (
    window !== null &&
    window.start.getTime() <= time &&
    time < window.end.getTime()
  );
};
