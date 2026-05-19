import 'reflect-metadata';
import {
  UsersByRole,
  ReservationsByCategory,
  adminStatus,
} from '../dto/adminStatus.input';

describe('adminStatus DTOs', () => {
  it('UsersByRole instanciation et propriétés', () => {
    const u = new UsersByRole();
    u.roleId = 1;
    u.role_name = 'role';
    u.count = 5;
    expect(u).toHaveProperty('roleId', 1);
    expect(u).toHaveProperty('role_name', 'role');
    expect(u).toHaveProperty('count', 5);
  });

  it('ReservationsByCategory instanciation et propriétés', () => {
    const r = new ReservationsByCategory();
    r.flight_category = 'cat';
    r.count = 3;
    expect(r).toHaveProperty('flight_category', 'cat');
    expect(r).toHaveProperty('count', 3);
  });

  it('adminStatus instanciation et propriétés', () => {
    const s = new adminStatus();
    s.totalUsers = 1;
    s.totalAircrafts = 2;
    s.totalReservations = 3;
    s.totalFlights = 4;
    s.totalIncidents = 5;
    s.availableAircrafts = 6;
    s.pendingReservations = 7;
    s.flightHoursThisMonth = 8.5;
    s.usersByRole = [new UsersByRole()];
    s.reservationsByCategory = [new ReservationsByCategory()];
    expect(s).toMatchObject({
      totalUsers: 1,
      totalAircrafts: 2,
      totalReservations: 3,
      totalFlights: 4,
      totalIncidents: 5,
      availableAircrafts: 6,
      pendingReservations: 7,
      flightHoursThisMonth: 8.5,
    });
    expect(Array.isArray(s.usersByRole)).toBe(true);
    expect(Array.isArray(s.reservationsByCategory)).toBe(true);
  });

  it('decorators GraphQL définissent metadata design:type', () => {
    expect(
      Reflect.getMetadata('design:type', UsersByRole.prototype, 'roleId'),
    ).toBe(Number);
    expect(
      Reflect.getMetadata('design:type', UsersByRole.prototype, 'role_name'),
    ).toBe(String);
    expect(
      Reflect.getMetadata('design:type', UsersByRole.prototype, 'count'),
    ).toBe(Number);
    expect(
      Reflect.getMetadata(
        'design:type',
        ReservationsByCategory.prototype,
        'flight_category',
      ),
    ).toBe(String);
    expect(
      Reflect.getMetadata(
        'design:type',
        ReservationsByCategory.prototype,
        'count',
      ),
    ).toBe(Number);
    expect(
      Reflect.getMetadata('design:type', adminStatus.prototype, 'totalUsers'),
    ).toBe(Number);
    expect(
      Reflect.getMetadata(
        'design:type',
        adminStatus.prototype,
        'flightHoursThisMonth',
      ),
    ).toBe(Number);
    expect(
      Reflect.getMetadata('design:type', adminStatus.prototype, 'usersByRole'),
    ).toBe(Array);
  });

  it('ReservationsByCategory instanciation et propriétés', () => {
    const r = new ReservationsByCategory();
    r.flight_category = 'cat';
    r.count = 3;
    expect(r).toHaveProperty('flight_category', 'cat');
    expect(r).toHaveProperty('count', 3);
  });

  it('adminStatus instanciation et propriétés', () => {
    const s = new adminStatus();
    // assign numbers
    s.totalUsers = 1;
    s.totalAircrafts = 2;
    s.totalReservations = 3;
    s.totalFlights = 4;
    s.totalIncidents = 5;
    s.availableAircrafts = 6;
    s.pendingReservations = 7;
    s.flightHoursThisMonth = 8.5;
    s.usersByRole = [new UsersByRole()];
    s.reservationsByCategory = [new ReservationsByCategory()];
    expect(s).toMatchObject({
      totalUsers: 1,
      totalAircrafts: 2,
      totalReservations: 3,
      totalFlights: 4,
      totalIncidents: 5,
      availableAircrafts: 6,
      pendingReservations: 7,
      flightHoursThisMonth: 8.5,
    });
    expect(Array.isArray(s.usersByRole)).toBe(true);
    expect(Array.isArray(s.reservationsByCategory)).toBe(true);
  });
});
