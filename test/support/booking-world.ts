import { PaymentsService } from '../../src/modules/payments/payments.service';
import { ReservationsService } from '../../src/modules/reservations/reservations.service';
import { FlightCategory } from '../../src/modules/reservations/entity/reservations.entity';
import { FakeDatabase, tables } from './fake-database';

// A small club for the booking and money tests: one member with a licence
// and some money, two aircraft, opening hours 08:00-20:00 (club time), closed
// on Sundays. Reservations and payments are the real services.
export const NOW = new Date('2027-01-11T12:00:00Z'); // a Monday
// Tuesday 12 January 2027, 10:00-11:00 at the club (Paris is UTC+1 then).
export const SLOT = {
  start_time: new Date('2027-01-12T09:00:00Z'),
  end_time: new Date('2027-01-12T10:00:00Z'),
};

export const bookingWorld = (
  options: { balance?: number; rate?: number } = {},
) => {
  const database = new FakeDatabase();
  const member = database.insert(tables.User, {
    first_name: 'John',
    email: 'john@test.com',
    language: 'fr',
    user_account_balance: options.balance ?? 500,
    licenses: [
      {
        license_type: 'PPL',
        is_valid: true,
        status: 'active',
        expiration_date: new Date('2028-01-01T00:00:00Z'),
      },
    ],
  });
  const aircraft = database.insert(tables.Aircraft, {
    registration_number: 'F-ABCD',
    hourly_cost: options.rate ?? 150,
    availability_status: 'AVAILABLE',
  });
  const otherAircraft = database.insert(tables.Aircraft, {
    registration_number: 'F-WXYZ',
    hourly_cost: options.rate ?? 150,
    availability_status: 'AVAILABLE',
  });

  const settings = {
    pilotLicenses: ['PPL'],
    closureDays: ['Dimanche'],
    reservationStartTime: '08:00:00',
    reservationEndTime: '20:00:00',
  };
  const mailer = { sendMail: jest.fn().mockResolvedValue(true) };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  const administration = { findAll: jest.fn(async () => [settings]) };

  const payments = new PaymentsService(
    database.repository(tables.Payment),
    {} as any,
    {} as any,
    database.repository(tables.User),
    database.repository(tables.Invoice),
    notifications as any,
  );
  const reservations = new ReservationsService(
    database.repository(tables.Reservation),
    {} as any,
    mailer as any,
    database.repository(tables.User),
    database.repository(tables.Aircraft),
    administration as any,
    payments,
    notifications as any,
  );

  const input = (overrides: object = {}) =>
    ({
      aircraft_id: aircraft.id,
      user_id: member.id,
      flight_category: FlightCategory.LOCAL,
      ...SLOT,
      ...overrides,
    }) as any;

  return {
    database,
    member,
    aircraft,
    otherAircraft,
    settings,
    mailer,
    notifications,
    payments,
    reservations,
    input,
    balance: () => database.balanceOf(member.id),
    paymentLines: () =>
      database
        .rows(tables.Payment)
        .map((line) => `${line.kind}:${Number(line.amount).toFixed(2)}`),
  };
};
