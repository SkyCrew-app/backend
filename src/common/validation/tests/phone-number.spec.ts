import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  IsPhoneNumberField,
  normalisePhoneNumber,
  PHONE_NUMBER,
} from '../phone-number';
import { CreateUserInput } from '../../../modules/users/dto/create-user.input';
import { UpdateUserInput } from '../../../modules/users/dto/update-user.input';
import { UpdateAdministrationInput } from '../../../modules/administration/dto/update-admin.input';

class Required {
  @IsPhoneNumberField()
  phone: string;
}

const phoneErrors = async <T extends object>(
  type: new () => T,
  value: Partial<T>,
  property: string,
) => {
  const instance = plainToInstance(type, value);
  const errors = await validate(instance, { skipMissingProperties: false });
  return {
    instance,
    messages: errors
      .filter((error) => error.property === property)
      .flatMap((error) => Object.values(error.constraints ?? {})),
  };
};

describe('phone numbers', () => {
  it.each([
    ['06 12 34 56 78', '0612345678'],
    ['06.12.34.56.78', '0612345678'],
    ['06-12-34-56-78', '0612345678'],
    ['+33 6 12 34 56 78', '+33612345678'],
    ['0033 6 12 34 56 78', '+33612345678'],
    ['+44 (20) 7946-0958', '+442079460958'],
    ['+1 415.555.2671', '+14155552671'],
  ])('stores %s as %s', (typed, stored) => {
    expect(normalisePhoneNumber(typed)).toBe(stored);
    expect(PHONE_NUMBER.test(stored)).toBe(true);
  });

  it.each([
    '123',
    '0612345',
    '06123456789',
    '+1234567',
    '+1234567890123456',
    '+0612345678',
    '+33 6 12 34 AB 78',
    '612345678',
  ])('refuses %s', (typed) => {
    expect(PHONE_NUMBER.test(normalisePhoneNumber(typed) as string)).toBe(
      false,
    );
  });

  it('accepts the shortest and longest international numbers', () => {
    expect(PHONE_NUMBER.test('+12345678')).toBe(true);
    expect(PHONE_NUMBER.test('+123456789012345')).toBe(true);
  });

  it('requires a number where the field is not optional', async () => {
    expect(
      (await phoneErrors(Required, { phone: '' }, 'phone')).messages,
    ).toEqual(['Numéro de téléphone invalide']);
  });

  it('cleans and checks the phone of a member being updated', async () => {
    const valid = await phoneErrors(
      UpdateUserInput,
      { phone_number: '+49 30 901820' },
      'phone_number',
    );
    expect(valid.messages).toEqual([]);
    expect(valid.instance.phone_number).toBe('+4930901820');

    const invalid = await phoneErrors(
      UpdateUserInput,
      { phone_number: 'appelez-moi' },
      'phone_number',
    );
    expect(invalid.messages).toEqual(['Numéro de téléphone invalide']);
  });

  it('lets a member have no phone number', async () => {
    for (const phone_number of ['', null, undefined]) {
      const { messages } = await phoneErrors(
        UpdateUserInput,
        { phone_number },
        'phone_number',
      );
      expect(messages).toEqual([]);
    }
  });

  it('checks the phone of a member being created', async () => {
    const { messages, instance } = await phoneErrors(
      CreateUserInput,
      { phone_number: '06 12 34 56 78' },
      'phone_number',
    );
    expect(messages).toEqual([]);
    expect(instance.phone_number).toBe('0612345678');

    expect(
      (
        await phoneErrors(
          CreateUserInput,
          { phone_number: '12' },
          'phone_number',
        )
      ).messages,
    ).toEqual(['Numéro de téléphone invalide']);
  });

  it('checks the contact phone of the club', async () => {
    const valid = await phoneErrors(
      UpdateAdministrationInput,
      { id: 1, contactPhone: '+33 4 78 12 34 56' },
      'contactPhone',
    );
    expect(valid.messages).toEqual([]);
    expect(valid.instance.contactPhone).toBe('+33478123456');

    const invalid = await phoneErrors(
      UpdateAdministrationInput,
      { id: 1, contactPhone: '1234' },
      'contactPhone',
    );
    expect(invalid.messages).toEqual(['Numéro de téléphone invalide']);

    // Other settings can be saved without sending the phone again.
    const absent = await phoneErrors(
      UpdateAdministrationInput,
      { id: 1 },
      'contactPhone',
    );
    expect(absent.messages).toEqual([]);
  });
});
