import {
  Reservation,
  ReservationStatus,
  FlightCategory,
} from '../entity/reservations.entity';
import { User } from '../../users/entity/users.entity';
import { Aircraft } from '../../aircraft/entity/aircraft.entity';
import { Flight } from '../../flights/entity/flights.entity';

describe('Reservation Entity', () => {
  it('should create a reservation instance', () => {
    const reservation = new Reservation();
    expect(reservation).toBeInstanceOf(Reservation);
  });

  it('should set all properties correctly', () => {
    const reservation = new Reservation();
    const user = new User();
    const aircraft = new Aircraft();
    const flight = new Flight();

    user.id = 1;
    aircraft.id = 1;
    flight.id = 1;

    reservation.id = 1;
    reservation.aircraft = aircraft;
    reservation.user = user;
    reservation.flights = [flight];
    reservation.reservation_date = new Date('2023-05-25');
    reservation.start_time = new Date('2023-06-01T08:00:00Z');
    reservation.end_time = new Date('2023-06-01T10:00:00Z');
    reservation.estimated_flight_hours = 2.5;
    reservation.purpose = 'Training flight';
    reservation.status = ReservationStatus.CONFIRMED;
    reservation.flight_category = FlightCategory.INSTRUCTION;
    reservation.notes = 'Clear weather expected';
    reservation.calendar_integration_url =
      'https://calendar.example.com/event/123';
    reservation.number_of_passengers = 2;

    expect(reservation.id).toBe(1);
    expect(reservation.aircraft).toBe(aircraft);
    expect(reservation.user).toBe(user);
    expect(reservation.flights).toEqual([flight]);
    expect(reservation.reservation_date).toEqual(new Date('2023-05-25'));
    expect(reservation.start_time).toEqual(new Date('2023-06-01T08:00:00Z'));
    expect(reservation.end_time).toEqual(new Date('2023-06-01T10:00:00Z'));
    expect(reservation.estimated_flight_hours).toBe(2.5);
    expect(reservation.purpose).toBe('Training flight');
    expect(reservation.status).toBe(ReservationStatus.CONFIRMED);
    expect(reservation.flight_category).toBe(FlightCategory.INSTRUCTION);
    expect(reservation.notes).toBe('Clear weather expected');
    expect(reservation.calendar_integration_url).toBe(
      'https://calendar.example.com/event/123',
    );
    expect(reservation.number_of_passengers).toBe(2);
  });

  it('should allow setting enum properties', () => {
    const reservation = new Reservation();

    // Test que on peut assigner les propriétés enum
    reservation.status = ReservationStatus.PENDING;
    reservation.flight_category = FlightCategory.CROSS_COUNTRY;

    expect(reservation.status).toBe(ReservationStatus.PENDING);
    expect(reservation.flight_category).toBe(FlightCategory.CROSS_COUNTRY);
  });

  it('should allow nullable fields', () => {
    const reservation = new Reservation();

    reservation.reservation_date = null;
    reservation.estimated_flight_hours = null;
    reservation.purpose = null;
    reservation.notes = null;
    reservation.calendar_integration_url = null;
    reservation.number_of_passengers = null;
    reservation.flights = null;

    expect(reservation.reservation_date).toBeNull();
    expect(reservation.estimated_flight_hours).toBeNull();
    expect(reservation.purpose).toBeNull();
    expect(reservation.notes).toBeNull();
    expect(reservation.calendar_integration_url).toBeNull();
    expect(reservation.number_of_passengers).toBeNull();
    expect(reservation.flights).toBeNull();
  });

  describe('ReservationStatus enum', () => {
    it('should have correct values', () => {
      expect(ReservationStatus.PENDING).toBe('pending');
      expect(ReservationStatus.CONFIRMED).toBe('confirmed');
      expect(ReservationStatus.CANCELLED).toBe('cancelled');
    });
  });

  describe('FlightCategory enum', () => {
    it('should have correct values', () => {
      expect(FlightCategory.LOCAL).toBe('local');
      expect(FlightCategory.CROSS_COUNTRY).toBe('cross_country');
      expect(FlightCategory.INSTRUCTION).toBe('instruction');
      expect(FlightCategory.TOURISM).toBe('tourism');
      expect(FlightCategory.TRAINING).toBe('training');
      expect(FlightCategory.MAINTENANCE).toBe('maintenance');
      expect(FlightCategory.PRIVATE).toBe('private');
      expect(FlightCategory.CORPORATE).toBe('corporate');
    });
  });
});
