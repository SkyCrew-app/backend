import { CronService } from '../cron.service';
import {
  CLUB_TIME_ZONE,
  clubDayStart,
  clubMonthStart,
} from '../../reservations/booking-rules';

// The nightly jobs follow the club's clock, not the server's.
describe('jobs on the club clock', () => {
  it('schedules every job in the club time zone', () => {
    const jobs = [
      'handleCourseStatusUpdate',
      'handleLicenseExpiration',
      'sendLicenceDigest',
      'handleReservationNotifications',
      'generateMonthlyFinancialReport',
      'notificationFinishReservation',
    ];
    for (const job of jobs) {
      const options = Reflect.getMetadata(
        'SCHEDULE_CRON_OPTIONS',
        CronService.prototype[job],
      );
      expect({ job, timeZone: options?.timeZone }).toEqual({
        job,
        timeZone: CLUB_TIME_ZONE,
      });
    }
  });

  it.each([
    // 23:30 in Paris on 14 October (summer time).
    [
      '2026-10-14T21:30:00Z',
      '2026-10-13T22:00:00.000Z',
      '2026-10-14T22:00:00.000Z',
    ],
    // 01:30 in Paris on 25 October, the night clocks go back.
    [
      '2026-10-24T23:30:00Z',
      '2026-10-24T22:00:00.000Z',
      '2026-10-25T23:00:00.000Z',
    ],
    // 00:30 in Paris on 1 January (winter time).
    [
      '2025-12-31T23:30:00Z',
      '2025-12-31T23:00:00.000Z',
      '2026-01-01T23:00:00.000Z',
    ],
  ])(
    'starts the club day of %s at %s, the next at %s',
    (at, today, tomorrow) => {
      expect(clubDayStart(new Date(at)).toISOString()).toBe(today);
      expect(clubDayStart(new Date(at), 1).toISOString()).toBe(tomorrow);
    },
  );

  it('gives the months at the club', () => {
    const at = new Date('2026-10-31T23:30:00Z'); // 1 November in Paris
    expect(clubMonthStart(at).toISOString()).toBe('2026-10-31T23:00:00.000Z');
    expect(clubMonthStart(at, -1).toISOString()).toBe(
      '2026-09-30T22:00:00.000Z',
    );
  });

  it('looks for the bookings of tomorrow at the club', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-14T22:30:00Z') }); // 00:30, 15 Oct
    const reservations = {
      findReservationsBetween: jest.fn().mockResolvedValue([]),
    };
    const service = new CronService(
      {} as any,
      {} as any,
      {} as any,
      reservations as any,
      {} as any,
      {} as any,
    );

    await service.handleReservationNotifications();

    const [start, end] = reservations.findReservationsBetween.mock.calls[0];
    expect(start.toISOString()).toBe('2026-10-15T22:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-16T21:59:59.999Z');
    jest.useRealTimers();
  });
});
