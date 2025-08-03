import 'reflect-metadata';
import { Administration } from '../entity/admin.entity';

describe('Administration Entity', () => {
  it('instanciation et propriétés defaults', () => {
    const e = new Administration();
    e.id = 1;
    e.clubName = 'club';
    e.contactEmail = 'e@x.com';
    e.contactPhone = '123';
    e.address = 'addr';
    e.timeSlotDuration = 30;
    e.reservationStartTime = '08:00';
    e.reservationEndTime = '17:00';
    e.allowGuestPilots = true;
    expect(e).toHaveProperty('id', 1);
    expect(e).toHaveProperty('clubName', 'club');
    expect(e).toHaveProperty('contactEmail', 'e@x.com');
  });

  it('decorators TypeORM et GraphQL définissent metadata design:type', () => {
    expect(
      Reflect.getMetadata('design:type', Administration.prototype, 'id'),
    ).toBe(Number);
    expect(
      Reflect.getMetadata('design:type', Administration.prototype, 'clubName'),
    ).toBe(String);
    expect(
      Reflect.getMetadata(
        'design:type',
        Administration.prototype,
        'reservationStartTime',
      ),
    ).toBe(String);
    expect(
      Reflect.getMetadata(
        'design:type',
        Administration.prototype,
        'isMaintenanceActive',
      ),
    ).toBe(Boolean);
    expect(
      Reflect.getMetadata(
        'design:type',
        Administration.prototype,
        'maintenanceTime',
      ),
    ).toBe(Date);
  });
});
