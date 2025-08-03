import 'reflect-metadata';
import { CreateAircraftInput } from '../dto/create-aircraft.input';
import { AvailabilityStatus } from '../entity/aircraft.entity';

describe('CreateAircraftInput DTO', () => {
  it('instanciation et propriétés', () => {
    const input = new CreateAircraftInput();
    input.registration_number = 'RN123';
    input.model = 'M1';
    input.year_of_manufacture = 2022;
    input.availability_status = AvailabilityStatus.RESERVATED;
    input.maintenance_status = 'OK';
    input.hourly_cost = 150.5;
    input.image_url = 'img.png';
    input.documents_url = ['doc1.pdf', 'doc2.pdf'];
    input.last_inspection_date = new Date('2023-01-01');
    input.current_location = 'LOC1';
    input.maxAltitude = 10000;
    input.cruiseSpeed = 300;
    input.consumption = 8;
    expect(input).toMatchObject({
      registration_number: 'RN123',
      model: 'M1',
      year_of_manufacture: 2022,
      availability_status: AvailabilityStatus.RESERVATED,
      maintenance_status: 'OK',
      hourly_cost: 150.5,
      image_url: 'img.png',
      documents_url: ['doc1.pdf', 'doc2.pdf'],
      last_inspection_date: new Date('2023-01-01'),
      current_location: 'LOC1',
      maxAltitude: 10000,
      cruiseSpeed: 300,
      consumption: 8,
    });
  });

  it('decorators GraphQL définissent design:type', () => {
    expect(
      Reflect.getMetadata(
        'design:type',
        CreateAircraftInput.prototype,
        'registration_number',
      ),
    ).toBe(String);
    expect(
      Reflect.getMetadata(
        'design:type',
        CreateAircraftInput.prototype,
        'year_of_manufacture',
      ),
    ).toBe(Number);
    expect(
      Reflect.getMetadata(
        'design:type',
        CreateAircraftInput.prototype,
        'availability_status',
      ),
    ).toBe(String);
    expect(
      Reflect.getMetadata(
        'design:type',
        CreateAircraftInput.prototype,
        'hourly_cost',
      ),
    ).toBe(Number);
    expect(
      Reflect.getMetadata(
        'design:type',
        CreateAircraftInput.prototype,
        'last_inspection_date',
      ),
    ).toBe(Date);
  });
});
