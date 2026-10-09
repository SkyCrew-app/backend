import { ValidationPipeOptions } from '@nestjs/common';

// GraphQL already rejects unknown fields and wrong types from the schema.
// The pipe adds the class-validator rules of the inputs that declare some.
//
// `whitelist` and `forbidNonWhitelisted` must stay off: with them, every
// property of an input that has no validation decorator is treated as
// unknown, and the whole mutation is refused.
export const validationPipeOptions: ValidationPipeOptions = {
  transform: true,
};
