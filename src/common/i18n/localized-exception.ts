import { HttpException } from '@nestjs/common';
import { TranslationKey } from './fr';
import { DEFAULT_LANGUAGE } from './languages';
import { ParamsArgument, renderTranslation } from './translate';

export interface MessageTranslation {
  key: TranslationKey;
  params?: Record<string, string | number>;
}

const TRANSLATION = Symbol('translation');

type Localized = HttpException & { [TRANSLATION]?: MessageTranslation };

// A refusal written for the person making the request. It is thrown in
// French and rewritten in the language of the request on its way out
// (see LocalizedExceptionFilter).
export function localized<
  Exception extends HttpException,
  Key extends TranslationKey,
>(
  ExceptionClass: new (message: string) => Exception,
  key: Key,
  ...[params]: ParamsArgument<Key>
): Exception {
  const exception: Localized = new ExceptionClass(
    renderTranslation(DEFAULT_LANGUAGE, key, params),
  );
  exception[TRANSLATION] = { key, params };
  return exception as Exception;
}

export const translationOf = (exception: unknown): MessageTranslation | null =>
  (exception instanceof HttpException &&
    (exception as Localized)[TRANSLATION]) ||
  null;
