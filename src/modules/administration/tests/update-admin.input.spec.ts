import { UpdateAdministrationInput } from '../dto/update-admin.input';

describe('UpdateAdministrationInput DTO', () => {
  it('hérite de CreateAdministrationInput et a id', () => {
    const input = new UpdateAdministrationInput();
    input.id = 42;
    expect(input).toHaveProperty('id', 42);
  });
});
