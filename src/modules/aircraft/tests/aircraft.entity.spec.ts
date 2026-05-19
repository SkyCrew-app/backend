import 'reflect-metadata';
import { Aircraft, AvailabilityStatus } from '../entity/aircraft.entity';

describe('Aircraft Entity', () => {
  it('instanciation et propriétés defaults', () => {
    const a = new Aircraft();
    a.id = 1;
    a.registration_number = 'RN';
    a.model = 'M';
    a.year_of_manufacture = 2020;
    a.availability_status = AvailabilityStatus.AVAILABLE;
    a.maintenance_status = 'OK';
    a.hourly_cost = 100;
    expect(a).toHaveProperty('id', 1);
    expect(a).toHaveProperty('registration_number', 'RN');
    expect(a).toHaveProperty(
      'availability_status',
      AvailabilityStatus.AVAILABLE,
    );
  });

  it('decorators TypeORM et GraphQL définissent metadata design:type', () => {
    expect(Reflect.getMetadata('design:type', Aircraft.prototype, 'id')).toBe(
      Number,
    );
    expect(
      Reflect.getMetadata(
        'design:type',
        Aircraft.prototype,
        'registration_number',
      ),
    ).toBe(String);
    expect(
      Reflect.getMetadata(
        'design:type',
        Aircraft.prototype,
        'year_of_manufacture',
      ),
    ).toBe(Number);
    expect(
      Reflect.getMetadata(
        'design:type',
        Aircraft.prototype,
        'availability_status',
      ),
    ).toBe(String);
    expect(
      Reflect.getMetadata('design:type', Aircraft.prototype, 'reservations'),
    ).toBe(Array);
  });
});
