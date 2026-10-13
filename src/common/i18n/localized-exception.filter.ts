import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { GqlArgumentsHost, GqlExceptionFilter } from '@nestjs/graphql';
import { DEFAULT_LANGUAGE } from './languages';
import { translationOf } from './localized-exception';
import { languageOfRequest } from './request-language';
import { renderTranslation } from './translate';

// Rewrites the refusals written for the person making the request in the
// language of that request. Every other exception goes through untouched.
@Catch(HttpException)
export class LocalizedExceptionFilter implements GqlExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): HttpException {
    const translation = translationOf(exception);
    if (!translation) {
      return exception;
    }

    const language = languageOfRequest(
      GqlArgumentsHost.create(host).getContext()?.req,
    );
    if (language === DEFAULT_LANGUAGE) {
      return exception;
    }

    const ExceptionClass = exception.constructor as new (
      message: string,
    ) => HttpException;
    return new ExceptionClass(
      renderTranslation(language, translation.key, translation.params),
    );
  }
}
