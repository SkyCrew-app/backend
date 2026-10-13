import { isEmail } from 'class-validator';

// E-mail addresses identify members whatever the case they are typed in:
// they are stored and compared in this form.
export const normalizeEmail = (email: string | null | undefined): string =>
  (email ?? '').trim().toLowerCase();

export const isEmailAddress = (email: string): boolean => isEmail(email);
