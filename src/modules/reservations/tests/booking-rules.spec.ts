import { validate } from 'class-validator';
import { translationOf } from '../../../common/i18n/localized-exception';
import { CreateExpenseInput } from '../../financial/dto/create-expense.dto';
import {
  assertAllowedToFly,
  assertCanInstruct,
  assertCancellable,
  assertClubOpen,
  instructorFeeCents,
  INSTRUCTOR_FEE_PER_HOUR,
  CLUB_TIME_ZONE,
  clubMoment,
  hasValidLicence,
  mailDate,
  priceCents,
  weeklyMaintenanceWindow,
} from '../booking-rules';

const keyOf = (run: () => void) => {
  try {
    run();
    return null;
  } catch (error) {
    return translationOf(error)?.key ?? error.message;
  }
};

describe('booking rules', () => {
  const settings = {
    closureDays: ['Dimanche'],
    reservationStartTime: '08:00:00',
    reservationEndTime: '20:00:00',
  };

  it('reads days and hours at the club, in summer as in winter', () => {
    expect(CLUB_TIME_ZONE).toBe('Europe/Paris');
    // Paris is UTC+2 in July, UTC+1 in January.
    expect(clubMoment(new Date('2027-07-13T06:30:00Z'))).toEqual({
      day: '2027-07-13',
      weekday: 'tuesday',
      minutesOfDay: 8 * 60 + 30,
    });
    // Saturday 23:30 UTC is already Sunday at the club.
    expect(clubMoment(new Date('2027-01-16T23:30:00Z')).weekday).toBe('sunday');
    expect(mailDate(new Date('2027-07-13T12:00:00Z'), 'fr')).toBe(
      '13 juillet 2027, 14:00',
    );
    expect(mailDate(new Date('2027-01-05T07:05:00Z'), 'en')).toBe(
      '5 January 2027, 08:05',
    );
  });

  it('applies the opening hours in club time', () => {
    const open = (start: string, end: string) =>
      keyOf(() => assertClubOpen(settings, new Date(start), new Date(end)));

    // 08:00-20:00 at the club in July is 06:00-18:00 UTC.
    expect(open('2027-07-13T06:00:00Z', '2027-07-13T18:00:00Z')).toBeNull();
    expect(open('2027-07-13T05:59:00Z', '2027-07-13T07:00:00Z')).toBe(
      'error.reservation.outsideOpeningHours',
    );
    expect(open('2027-07-13T17:00:00Z', '2027-07-13T18:01:00Z')).toBe(
      'error.reservation.outsideOpeningHours',
    );
    // Over two days.
    expect(open('2027-07-13T17:00:00Z', '2027-07-14T07:00:00Z')).toBe(
      'error.reservation.outsideOpeningHours',
    );
    // Sunday 18 July 2027.
    expect(open('2027-07-18T08:00:00Z', '2027-07-18T09:00:00Z')).toBe(
      'error.reservation.clubClosedDay',
    );
  });

  it('keeps new bookings out of the weekly maintenance, from opening time for its length', () => {
    // Monday 12 July 2027, 08:00-12:00 at the club (06:00-10:00 UTC).
    const weekly = {
      ...settings,
      maintenanceDay: 'Lundi',
      maintenanceDuration: 4,
    };
    const open = (start: string, end: string) =>
      keyOf(() => assertClubOpen(weekly, new Date(start), new Date(end)));

    expect(weeklyMaintenanceWindow(weekly)).toEqual({
      weekday: 'monday',
      from: 8 * 60,
      to: 12 * 60,
    });
    expect(open('2027-07-12T09:00:00Z', '2027-07-12T10:30:00Z')).toBe(
      'error.reservation.weeklyMaintenance',
    );
    expect(open('2027-07-12T06:00:00Z', '2027-07-12T07:00:00Z')).toBe(
      'error.reservation.weeklyMaintenance',
    );
    // Right after it, and on another day.
    expect(open('2027-07-12T10:00:00Z', '2027-07-12T11:00:00Z')).toBeNull();
    expect(open('2027-07-13T07:00:00Z', '2027-07-13T08:00:00Z')).toBeNull();
    // An English day name works too; no length, no window.
    expect(
      keyOf(() =>
        assertClubOpen(
          { ...weekly, maintenanceDay: 'Monday' },
          new Date('2027-07-12T07:00:00Z'),
          new Date('2027-07-12T08:00:00Z'),
        ),
      ),
    ).toBe('error.reservation.weeklyMaintenance');
    expect(
      weeklyMaintenanceWindow({ ...weekly, maintenanceDuration: 0 }),
    ).toBeNull();
    const refusal = (() => {
      try {
        assertClubOpen(
          weekly,
          new Date('2027-07-12T07:00:00Z'),
          new Date('2027-07-12T08:00:00Z'),
        );
      } catch (error) {
        return translationOf(error);
      }
    })();
    expect(refusal?.params).toEqual({ from: '08:00', to: '12:00' });
  });

  it('applies no opening hours when the settings define none', () => {
    expect(
      keyOf(() =>
        assertClubOpen(
          {
            closureDays: null,
            reservationStartTime: '',
            reservationEndTime: '',
          },
          new Date('2027-07-13T01:00:00Z'),
          new Date('2027-07-13T02:00:00Z'),
        ),
      ),
    ).toBeNull();
  });

  it('accepts a licence valid until the end of the flight', () => {
    const flightEnd = new Date('2027-01-12T10:00:00Z');
    const licence = { license_type: 'PPL', is_valid: true, status: 'active' };

    expect(hasValidLicence([licence], ['PPL'], flightEnd)).toBe(true);
    expect(
      hasValidLicence(
        [{ ...licence, expiration_date: new Date('2027-01-12T09:00:00Z') }],
        ['PPL'],
        flightEnd,
      ),
    ).toBe(false);
    // A club that lists no type accepts every type, not nobody.
    expect(hasValidLicence([licence], [], flightEnd)).toBe(true);
    expect(hasValidLicence([], [], flightEnd)).toBe(false);
  });

  it('asks the pilot for a licence alone, the instructor for it with one', () => {
    const flightEnd = new Date('2027-01-12T10:00:00Z');
    const licence = { license_type: 'PPL', is_valid: true, status: 'active' };
    const crew = { acceptedTypes: ['PPL'], flightEnd };

    // Alone.
    expect(
      keyOf(() =>
        assertAllowedToFly({
          ...crew,
          pilotLicences: [licence],
          withInstructor: false,
        }),
      ),
    ).toBeNull();
    expect(
      keyOf(() =>
        assertAllowedToFly({
          ...crew,
          pilotLicences: [],
          withInstructor: false,
        }),
      ),
    ).toBe('error.reservation.instructorRequired');
    // With an instructor, the pilot's licence no longer matters.
    expect(
      keyOf(() =>
        assertAllowedToFly({
          ...crew,
          pilotLicences: [],
          instructorLicences: [licence],
          withInstructor: true,
        }),
      ),
    ).toBeNull();
    expect(
      keyOf(() =>
        assertAllowedToFly({
          ...crew,
          pilotLicences: [licence],
          instructorLicences: [{ ...licence, status: 'expired' }],
          withInstructor: true,
        }),
      ),
    ).toBe('error.reservation.instructorNoValidLicence');
  });

  it('accepts as instructor an active member with the instructor role, other than the pilot', () => {
    const instructor = { id: 8, role: { role_name: 'Instructeur' } };

    expect(keyOf(() => assertCanInstruct(instructor, 3))).toBeNull();
    expect(keyOf(() => assertCanInstruct(instructor, 8))).toBe(
      'error.reservation.instructorIsPilot',
    );
    expect(
      keyOf(() => assertCanInstruct({ ...instructor, is_active: false }, 3)),
    ).toBe('error.reservation.notAnInstructor');
    expect(
      keyOf(() => assertCanInstruct({ id: 8, role: 'Administrateur' }, 3)),
    ).toBe('error.reservation.notAnInstructor');
    expect(keyOf(() => assertCanInstruct({ id: 8, role: null }, 3))).toBe(
      'error.reservation.notAnInstructor',
    );
  });

  it('adds no instructor fee: the one place where it would be set', () => {
    const start = new Date('2027-01-12T09:00:00Z');
    const end = new Date('2027-01-12T10:30:00Z');

    expect(INSTRUCTOR_FEE_PER_HOUR).toBe(0);
    expect(instructorFeeCents(true, start, end)).toBe(0);
    expect(instructorFeeCents(false, start, end)).toBe(0);
  });

  it('prices in cents and refuses a negative rate', () => {
    const start = new Date('2027-01-12T09:00:00Z');
    const end = new Date('2027-01-12T10:30:00Z');
    expect(priceCents(133.33, start, end)).toBe(20000);
    expect(priceCents(0, start, end)).toBe(0);
    expect(keyOf(() => priceCents(-150, start, end))).toBe(
      'error.reservation.invalidPrice',
    );
  });

  it('lets a member cancel at the start time exactly, not after', () => {
    const booking = { start_time: new Date('2027-01-12T09:00:00Z') };
    const member = { isAdmin: false };

    expect(
      keyOf(() => assertCancellable(booking, member, booking.start_time)),
    ).toBeNull();
    expect(
      keyOf(() =>
        assertCancellable(booking, member, new Date('2027-01-12T09:00:01Z')),
      ),
    ).toBe('error.reservation.cancelAfterStart');
  });

  it('refuses an expense that is not a positive amount', async () => {
    const expense = (amount: number) =>
      Object.assign(new CreateExpenseInput(), {
        expense_date: new Date(),
        category: 'Carburant',
        amount,
      });

    expect(await validate(expense(80.5))).toHaveLength(0);
    expect(await validate(expense(0))).not.toHaveLength(0);
    expect(await validate(expense(-80.5))).not.toHaveLength(0);
  });
});
