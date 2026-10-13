import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, Matches } from 'class-validator';

// International form ("+" and 8 to 15 digits, as E.164 allows) or the French
// national form (10 digits starting with 0).
export const PHONE_NUMBER = /^(\+[1-9]\d{7,14}|0[1-9]\d{8})$/;

export const PHONE_NUMBER_MESSAGE = 'Numéro de téléphone invalide';

// "+33 6 12-34.56 78" -> "+33612345678". Spaces, dots, dashes and brackets
// are how people write a number, not part of it; "00" is the "+" prefix.
export function normalisePhoneNumber(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const compact = value.replace(/[\s.\-()]/g, '');
  return compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
}

// For an input field holding a phone number: stored without separators,
// refused when it is not a number. `optional` also accepts an empty value.
export function IsPhoneNumberField({ optional = false } = {}) {
  const pattern = optional
    ? new RegExp(`^$|${PHONE_NUMBER.source}`)
    : PHONE_NUMBER;

  return applyDecorators(
    ...(optional ? [IsOptional()] : []),
    Transform(({ value }) => normalisePhoneNumber(value)),
    Matches(pattern, { message: PHONE_NUMBER_MESSAGE }),
  );
}
