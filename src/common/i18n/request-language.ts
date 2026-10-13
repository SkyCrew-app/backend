import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import {
  DEFAULT_LANGUAGE,
  Language,
  languageFromHeader,
  parseLanguage,
} from './languages';

interface LanguageRequest {
  headers?: Record<string, string | string[] | undefined>;
  user?: { language?: string | null } | null;
}

// The language to answer a request in: the one the interface says it is
// shown in, otherwise the member's stored language, otherwise French.
export const languageOfRequest = (
  request: LanguageRequest | null | undefined,
): Language => {
  const header = request?.headers?.['accept-language'];

  return (
    languageFromHeader(Array.isArray(header) ? header.join(',') : header) ??
    parseLanguage(request?.user?.language) ??
    DEFAULT_LANGUAGE
  );
};

export const RequestLanguage = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Language =>
    languageOfRequest(GqlExecutionContext.create(context).getContext()?.req),
);
