import { NotificationsService } from '../notifications.service';
import {
  NOTIFICATION_PRIORITY_HIGH,
  priorityOf,
} from '../notification-priority';
import { LicenceRemindersService } from '../../licenses/licence-reminders.service';
import { PaymentsService } from '../../payments/payments.service';
import { tables } from '../../../../test/support/fake-database';
import {
  bookingWorld,
  NOW,
  SLOT,
} from '../../../../test/support/booking-world';

// The "Prioritaires" tab of the notifications screen shows the
// notifications whose priority is "high".
describe('high-priority notifications', () => {
  it('marks the types that always matter, and keeps a priority given', async () => {
    const repository = {
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => row),
    };
    const service = new NotificationsService(
      repository as any,
      {
        sendNotification: jest.fn(),
      } as any,
    );
    const create = (notification_type: string, priority?: string) =>
      service.create({
        user_id: 1,
        notification_type,
        message: 'm',
        notification_date: new Date(),
        priority,
      });

    for (const type of [
      'AIRCRAFT_GROUNDED',
      'LICENSE_EXPIRED',
      'PAYMENT_FAILED',
    ]) {
      expect((await create(type)).priority).toBe('high');
    }
    expect((await create('RESERVATION_CONFIRMED')).priority).toBeUndefined();
    expect((await create('RESERVATION_CANCELLED', 'high')).priority).toBe(
      'high',
    );
    expect(priorityOf('LICENSE_EXPIRED', 'low')).toBe('low');
  });

  describe('a cancelled booking', () => {
    const instructionBooking = async () => {
      const world = bookingWorld({ balance: 500, rate: 150 });
      const instructor = world.database.insert(tables.User, {
        first_name: 'Irene',
        email: 'irene@test.com',
        language: 'fr',
        is_active: true,
        user_account_balance: 0,
        role: { role_name: 'Instructeur' },
        licenses: [
          {
            license_type: 'PPL',
            is_valid: true,
            status: 'active',
            expiration_date: new Date('2028-01-01T00:00:00Z'),
          },
        ],
      });
      const booking = await world.reservations.create(
        world.input({ instructor_id: instructor.id, ...SLOT }),
        NOW,
      );
      world.notifications.create.mockClear();
      const told = (userId: number, type: string) =>
        world.notifications.create.mock.calls
          .map(([notification]) => notification)
          .find(
            (notification) =>
              notification.user_id === userId &&
              notification.notification_type === type,
          );
      return { world, instructor, booking, told };
    };

    it('is high for the member when an administrator cancels it, and for the instructor', async () => {
      const { world, instructor, booking, told } = await instructionBooking();

      await world.reservations.delete(
        booking.id,
        { isAdmin: true, userId: 99 },
        NOW,
      );

      expect(told(world.member.id, 'RESERVATION_CANCELLED').priority).toBe(
        NOTIFICATION_PRIORITY_HIGH,
      );
      expect(told(instructor.id, 'INSTRUCTION_CANCELLED').priority).toBe(
        NOTIFICATION_PRIORITY_HIGH,
      );
    });

    it('is high for the pilot when the instructor declines, not for the instructor', async () => {
      const { world, instructor, booking, told } = await instructionBooking();

      await world.reservations.delete(
        booking.id,
        { isAdmin: false, userId: instructor.id },
        NOW,
      );

      expect(told(world.member.id, 'RESERVATION_CANCELLED').priority).toBe(
        NOTIFICATION_PRIORITY_HIGH,
      );
      expect(
        told(instructor.id, 'INSTRUCTION_CANCELLED').priority,
      ).toBeUndefined();
    });

    it('is not high for the holder who cancels it, but is for their instructor', async () => {
      const { world, instructor, booking, told } = await instructionBooking();

      await world.reservations.delete(
        booking.id,
        { isAdmin: false, userId: world.member.id },
        NOW,
      );

      expect(
        told(world.member.id, 'RESERVATION_CANCELLED').priority,
      ).toBeUndefined();
      expect(told(instructor.id, 'INSTRUCTION_CANCELLED').priority).toBe(
        NOTIFICATION_PRIORITY_HIGH,
      );
    });
  });

  it('is high for a licence reminder seven days or fewer before expiry', async () => {
    const now = new Date('2026-10-13T08:00:00Z');
    const licence = (days: number) => ({
      id: days,
      license_type: 'PPL',
      status: 'active',
      expiration_date: new Date(now.getTime() + days * 86400_000),
      expiry_reminder_days: null,
      expiry_reminder_for: null,
      user: { id: 9, email: 'j@club.fr', language: 'fr', is_active: true },
    });
    const notifications = { create: jest.fn() };
    const service = new LicenceRemindersService(
      {
        findExpiringLicenses: jest
          .fn()
          .mockResolvedValue([licence(30), licence(7)]),
        claimExpiryReminder: jest.fn().mockResolvedValue(true),
      } as any,
      notifications as any,
      { sendMail: jest.fn().mockResolvedValue(true) } as any,
      {} as any,
    );

    await service.sendExpiryReminders(now);

    const priorities = notifications.create.mock.calls.map(
      ([notification]) => notification.priority,
    );
    expect(priorities).toEqual([undefined, NOTIFICATION_PRIORITY_HIGH]);
  });

  describe('payments', () => {
    const payments = () => {
      const world = bookingWorld({ balance: 100 });
      const notifications = { create: jest.fn().mockResolvedValue({}) };
      const service = new PaymentsService(
        world.database.repository(tables.Payment),
        {} as any,
        {} as any,
        world.database.repository(tables.User),
        world.database.repository(tables.Invoice),
        notifications as any,
      );
      return { world, notifications, service };
    };

    it('tells the member, once, that a card payment failed', async () => {
      const { world, notifications, service } = payments();
      world.database.insert(tables.Payment, {
        user: { id: world.member.id },
        amount: 50,
        payment_method: 'stripe',
        payment_status: 'pending',
        kind: 'top_up',
        external_payment_id: 'pi_1',
      });

      await service.markPaymentFailed('pi_1');
      await service.markPaymentFailed('pi_1');

      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: world.member.id,
          notification_type: 'PAYMENT_FAILED',
          message: expect.stringContaining('a été refusé'),
        }),
      );
    });

    it('says a debit is a debit of the balance, with its currency', async () => {
      const { notifications, service } = payments();

      await service.notifyMovement(
        { id: 1, language: 'fr' },
        'WITHDRAWAL',
        42.5,
      );
      await service.notifyMovement(
        { id: 1, language: 'en' },
        'WITHDRAWAL',
        42.5,
      );

      const [fr, en] = notifications.create.mock.calls.map(
        ([notification]) => notification.message,
      );
      expect(fr).toMatch(/^42,50\s€ ont été débités de votre solde\.$/);
      expect(en).toBe('€42.50 has been debited from your balance.');
    });
  });
});
