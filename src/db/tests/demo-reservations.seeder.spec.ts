import { seedDemoReservations } from '../demo/demo-reservations.seeder';
import { Reservation } from '../../modules/reservations/entity/reservations.entity';
import { Payment } from '../../modules/payments/entity/payments.entity';
import { Invoice } from '../../modules/invoices/entity/invoices.entity';

// The demo bookings must be usable under the booking rules: a booking
// without its charged amount can be neither moved nor refunded.
describe('seedDemoReservations', () => {
  const seed = async () => {
    const saved = new Map<unknown, any[]>();
    const repository = (entity: unknown) => ({
      create: (row: object) => ({ ...row }),
      save: async (row: object) => {
        const rows = saved.get(entity) ?? [];
        saved.set(entity, rows);
        const stored = { id: rows.length + 1, ...row };
        rows.push(stored);
        return stored;
      },
    });
    const users = Array.from({ length: 10 }, (_, index) => ({ id: index + 1 }));
    const aircraft = [165, 155, 145, 210, 280, 120].map(
      (hourly_cost, index) => ({
        id: index + 1,
        hourly_cost,
      }),
    );
    jest.spyOn(console, 'log').mockImplementation();

    await seedDemoReservations(
      { getRepository: repository } as any,
      users as any,
      aircraft as any,
    );
    return {
      bookings: saved.get(Reservation) ?? [],
      payments: saved.get(Payment) ?? [],
      invoices: saved.get(Invoice) ?? [],
    };
  };

  it('fixes the price of every booking that holds, with its payment line', async () => {
    const { bookings, payments, invoices } = await seed();
    const held = bookings;
    expect(held.length).toBeGreaterThan(0);

    for (const booking of held) {
      const hours =
        (booking.end_time.getTime() - booking.start_time.getTime()) / 3_600_000;
      expect(booking.charged_amount).toBeCloseTo(
        hours * booking.aircraft.hourly_cost,
        2,
      );
      const lines = payments.filter(
        (payment) => payment.reservation_id === booking.id,
      );
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({
        kind: 'booking',
        amount: booking.charged_amount,
        payment_status: 'completed',
        user: { id: booking.user.id },
      });
      expect(lines[0].payment_date.getTime()).toBeLessThanOrEqual(Date.now());
    }
    expect(invoices).toHaveLength(held.length);
  });

  // users[8] is Emma, the student demo account (no valid licence), and
  // users[2] Marie, an instructor.
  it('gives the student an upcoming instruction booking with an instructor, paid like any other', async () => {
    const { bookings, payments } = await seed();
    const upcoming = bookings.filter(
      (booking) =>
        booking.user.id === 9 &&
        booking.instructor?.id === 3 &&
        booking.start_time.getTime() > Date.now(),
    );

    expect(upcoming).toHaveLength(1);
    const [booking] = upcoming;
    expect(booking.flight_category).toBe('instruction');
    expect(booking.status).toBe('confirmed');
    // The aircraft only: no instructor fee.
    const hours =
      (booking.end_time.getTime() - booking.start_time.getTime()) / 3_600_000;
    expect(booking.charged_amount).toBeCloseTo(
      hours * booking.aircraft.hourly_cost,
      2,
    );
    expect(
      payments.filter((payment) => payment.reservation_id === booking.id),
    ).toEqual([
      expect.objectContaining({
        kind: 'booking',
        amount: booking.charged_amount,
        user: { id: 9 },
      }),
    ]);
  });

  it('never lets the student fly without an instructor', async () => {
    const { bookings } = await seed();
    const students = bookings.filter((booking) => booking.user.id === 9);

    expect(students.length).toBeGreaterThan(0);
    for (const booking of students) {
      expect(booking.instructor?.id).toBe(3);
    }
  });

  // The API confirms a booking when it is made and deletes it when it is
  // cancelled: the demo shows no other state.
  it('only creates confirmed bookings, as the API does', async () => {
    const { bookings } = await seed();
    expect(bookings.length).toBeGreaterThan(0);
    for (const booking of bookings) {
      expect(booking.status).toBe('confirmed');
    }
  });

  it('keeps every booking inside the opening hours of the club (08:00-20:00)', async () => {
    const { bookings } = await seed();
    for (const booking of bookings) {
      expect(booking.start_time.getHours()).toBeGreaterThanOrEqual(8);
      expect(
        booking.end_time.getHours() * 60 + booking.end_time.getMinutes(),
      ).toBeLessThanOrEqual(20 * 60);
    }
  });
});
