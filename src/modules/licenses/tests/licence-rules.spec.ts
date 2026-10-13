import {
  daysUntil,
  dueReminder,
  LICENCE_REMINDER_DAYS,
  normaliseLicenceNumber,
  settleLicenceState,
} from '../licence-rules';

const NOW = new Date('2026-10-13T08:00:00Z');
const inDays = (days: number) => new Date(NOW.getTime() + days * 86400_000);

describe('licence rules', () => {
  it('reminds at 60, 30 and 7 days', () => {
    expect(LICENCE_REMINDER_DAYS).toEqual([60, 30, 7]);
  });

  describe('settleLicenceState', () => {
    it.each([
      // [stored, requested, expiry, expected]
      [{}, {}, null, { status: 'active', is_valid: true }],
      [
        { status: 'active' },
        {},
        inDays(10),
        { status: 'active', is_valid: true },
      ],
      [
        { status: 'active', is_valid: true },
        {},
        inDays(-1),
        { status: 'expired', is_valid: false },
      ],
      [
        { status: 'active' },
        { status: 'active', is_valid: true },
        inDays(-1),
        { status: 'expired', is_valid: false },
      ],
      [
        { status: 'active' },
        { status: 'pending' },
        inDays(10),
        { status: 'pending', is_valid: false },
      ],
      [
        { status: 'pending' },
        { status: 'active' },
        inDays(10),
        { status: 'active', is_valid: true },
      ],
      [
        { status: 'expired', is_valid: false },
        {},
        inDays(100),
        { status: 'active', is_valid: true },
      ],
      [{ status: 'expired' }, {}, null, { status: 'expired', is_valid: false }],
      [
        { status: 'active' },
        { is_valid: false },
        inDays(10),
        { status: 'pending', is_valid: false },
      ],
      [
        { status: 'pending' },
        { is_valid: true },
        inDays(10),
        { status: 'active', is_valid: true },
      ],
      [
        { status: 'pending', is_valid: true },
        {},
        inDays(10),
        { status: 'pending', is_valid: false },
      ],
    ])(
      '%j asked %j expiring %s gives %j',
      (stored, requested, expiry, expected) => {
        expect(
          settleLicenceState(
            { ...stored, expiration_date: expiry as Date | null },
            requested,
            NOW,
          ),
        ).toEqual(expected);
      },
    );

    it('never answers a valid licence that is not active', () => {
      for (const status of ['active', 'expired', 'pending']) {
        for (const is_valid of [true, false, undefined]) {
          for (const expiry of [null, inDays(-5), inDays(5)]) {
            const state = settleLicenceState(
              { status, expiration_date: expiry },
              { is_valid },
              NOW,
            );
            expect(state.is_valid).toBe(state.status === 'active');
          }
        }
      }
    });

    it('refuses a status it does not know', () => {
      expect(() =>
        settleLicenceState({}, { status: 'suspended' }, NOW),
      ).toThrow('Statut de licence inconnu');
    });
  });

  describe('dueReminder', () => {
    it.each([
      [61, null, null],
      [60, null, 60],
      [45, null, 60],
      [45, 60, null],
      [30, 60, 30],
      [29, 30, null],
      [7, 30, 7],
      [3, 7, null],
      [0, 30, 7],
      [-1, null, null],
    ])('%i days left, step %s already sent: %s', (daysLeft, sent, expected) => {
      expect(dueReminder(daysLeft, sent)).toBe(expected);
    });

    it('sends one reminder, not three, for a licence entered a few days before it expires', () => {
      expect(dueReminder(5, null)).toBe(7);
      expect(dueReminder(5, 7)).toBeNull();
    });
  });

  it('counts whole days left', () => {
    expect(daysUntil(inDays(30), NOW)).toBe(30);
    expect(daysUntil(new Date(NOW.getTime() + 3600_000), NOW)).toBe(1);
    expect(daysUntil(inDays(-2), NOW)).toBe(-2);
  });

  it('compares licence numbers without case or surrounding spaces', () => {
    expect(normaliseLicenceNumber('  ppl-fr-001 ')).toBe('PPL-FR-001');
    expect(normaliseLicenceNumber(null)).toBe('');
  });
});
