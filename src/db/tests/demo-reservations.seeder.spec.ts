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
    const held = bookings.filter((booking) => booking.status !== 'cancelled');
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

  it('charges nothing for a cancelled booking', async () => {
    const { bookings, payments } = await seed();
    const cancelled = bookings.filter(
      (booking) => booking.status === 'cancelled',
    );
    expect(cancelled.length).toBeGreaterThan(0);
    for (const booking of cancelled) {
      expect(booking.charged_amount).toBeNull();
      expect(
        payments.some((payment) => payment.reservation_id === booking.id),
      ).toBe(false);
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
