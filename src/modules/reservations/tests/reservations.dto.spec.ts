import { CreateReservationInput } from '../dto/create-reservation.input';
import { FlightCategory } from '../entity/reservations.entity';

describe('CreateReservationInput', () => {
  it('should create instance with required fields', () => {
    const dto = new CreateReservationInput();
    dto.aircraft_id = 1;
    dto.user_id = 1;
    dto.start_time = new Date('2023-06-01T08:00:00Z');
    dto.end_time = new Date('2023-06-01T10:00:00Z');
    dto.flight_category = FlightCategory.LOCAL;

    expect(dto.aircraft_id).toBe(1);
    expect(dto.user_id).toBe(1);
    expect(dto.start_time).toEqual(new Date('2023-06-01T08:00:00Z'));
    expect(dto.end_time).toEqual(new Date('2023-06-01T10:00:00Z'));
    expect(dto.flight_category).toBe(FlightCategory.LOCAL);
  });

  it('should allow optional fields', () => {
    const dto = new CreateReservationInput();
    dto.aircraft_id = 1;
    dto.user_id = 1;
    dto.start_time = new Date('2023-06-01T08:00:00Z');
    dto.end_time = new Date('2023-06-01T10:00:00Z');
    dto.flight_category = FlightCategory.INSTRUCTION;
    dto.reservation_date = new Date('2023-05-25');
    dto.purpose = 'Training flight';
    dto.estimated_flight_hours = 2.5;
    dto.notes = 'Clear weather expected';
    dto.status = 'confirmed';

    expect(dto.reservation_date).toEqual(new Date('2023-05-25'));
    expect(dto.purpose).toBe('Training flight');
    expect(dto.estimated_flight_hours).toBe(2.5);
    expect(dto.notes).toBe('Clear weather expected');
    expect(dto.status).toBe('confirmed');
  });

  it('should accept all flight categories', () => {
    const categories = [
      FlightCategory.LOCAL,
      FlightCategory.CROSS_COUNTRY,
      FlightCategory.INSTRUCTION,
      FlightCategory.TOURISM,
      FlightCategory.TRAINING,
      FlightCategory.MAINTENANCE,
      FlightCategory.PRIVATE,
      FlightCategory.CORPORATE,
    ];

    categories.forEach((category) => {
      const dto = new CreateReservationInput();
      dto.flight_category = category;
      expect(dto.flight_category).toBe(category);
    });
  });
});

import { UpdateReservationInput } from '../dto/update-reservation.input';

describe('UpdateReservationInput', () => {
  it('should have required id field', () => {
    const dto = new UpdateReservationInput();
    dto.id = 1;
    dto.flight_category = FlightCategory.LOCAL;

    expect(dto.id).toBe(1);
    expect(dto.flight_category).toBe(FlightCategory.LOCAL);
  });

  it('should allow all fields to be optional except id and flight_category', () => {
    const dto = new UpdateReservationInput();
    dto.id = 1;
    dto.flight_category = FlightCategory.INSTRUCTION;

    expect(dto.aircraft_id).toBeUndefined();
    expect(dto.user_id).toBeUndefined();
    expect(dto.reservation_date).toBeUndefined();
    expect(dto.start_time).toBeUndefined();
    expect(dto.end_time).toBeUndefined();
    expect(dto.purpose).toBeUndefined();
    expect(dto.estimated_flight_hours).toBeUndefined();
    expect(dto.notes).toBeUndefined();
  });

  it('should allow setting optional fields', () => {
    const dto = new UpdateReservationInput();
    dto.id = 1;
    dto.aircraft_id = 2;
    dto.user_id = 3;
    dto.flight_category = FlightCategory.TOURISM;
    dto.start_time = new Date('2023-06-02T09:00:00Z');
    dto.end_time = new Date('2023-06-02T11:00:00Z');
    dto.purpose = 'Sightseeing';
    dto.estimated_flight_hours = 2.0;
    dto.notes = 'Updated notes';

    expect(dto.id).toBe(1);
    expect(dto.aircraft_id).toBe(2);
    expect(dto.user_id).toBe(3);
    expect(dto.flight_category).toBe(FlightCategory.TOURISM);
    expect(dto.start_time).toEqual(new Date('2023-06-02T09:00:00Z'));
    expect(dto.end_time).toEqual(new Date('2023-06-02T11:00:00Z'));
    expect(dto.purpose).toBe('Sightseeing');
    expect(dto.estimated_flight_hours).toBe(2.0);
    expect(dto.notes).toBe('Updated notes');
  });
});
