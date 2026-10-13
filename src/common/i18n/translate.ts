import { en } from './en';
import { fr, TranslationKey } from './fr';
import { DEFAULT_LANGUAGE, Language, LANGUAGES } from './languages';

export const dictionaries: Record<Language, Record<TranslationKey, string>> = {
  fr,
  en,
};

type ParameterNames<Text extends string> =
  Text extends `${string}{{${infer Name}}}${infer Rest}`
    ? Name | ParameterNames<Rest>
    : never;

export type TranslationParams<Key extends TranslationKey> = Record<
  ParameterNames<(typeof fr)[Key]>,
  string | number
>;

// Keys without parameters take none; the others require exactly theirs.
export type ParamsArgument<Key extends TranslationKey> = [
  ParameterNames<(typeof fr)[Key]>,
] extends [never]
  ? []
  : [params: TranslationParams<Key>];

// For callers that carry a key and its parameters as data. Everything else
// goes through translate, which checks the parameters of each key.
export const renderTranslation = (
  language: Language,
  key: TranslationKey,
  params: Record<string, string | number> = {},
): string => {
  const dictionary = dictionaries[language] ?? dictionaries[DEFAULT_LANGUAGE];
  const text = dictionary[key] ?? fr[key];

  return text.replace(/{{(\w+)}}/g, (placeholder, name: string) =>
    name in params ? String(params[name]) : placeholder,
  );
};

export function translate<Key extends TranslationKey>(
  language: Language,
  key: Key,
  ...[params]: ParamsArgument<Key>
): string {
  return renderTranslation(language, key, params);
}

// The same text in every language, to recognise a message whatever the
// language it was written in.
export function translateInEveryLanguage<Key extends TranslationKey>(
  key: Key,
  ...params: ParamsArgument<Key>
): string[] {
  return LANGUAGES.map((language) => translate(language, key, ...params));
}
