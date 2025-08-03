import 'reflect-metadata';
import { UpdateAircraftInput } from '../dto/update-aircraft.input';

describe('UpdateAircraftInput DTO', () => {
  it('permet mutation des champs et héritage', () => {
    const input = new UpdateAircraftInput();
    input.model = 'M2';
    input.registration_number = 'RN456';
    expect(input).toHaveProperty('model', 'M2');
    expect(input).toHaveProperty('registration_number', 'RN456');
  });
});
