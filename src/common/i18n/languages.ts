export const LANGUAGES = ['fr', 'en'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'fr';

// A supported language out of a stored value or a language tag ("en-GB"),
// or null when it is not one of ours.
export const parseLanguage = (value: unknown): Language | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const primary = value.trim().toLowerCase().split(/[-_]/)[0];
  return (LANGUAGES as readonly string[]).includes(primary)
    ? (primary as Language)
    : null;
};

// The language a member is written to when they are not there: e-mails and
// notifications.
export const languageOf = (
  user: { language?: string | null } | null | undefined,
): Language => parseLanguage(user?.language) ?? DEFAULT_LANGUAGE;

// First supported language of an Accept-Language header, by preference.
export const languageFromHeader = (header: unknown): Language | null => {
  if (typeof header !== 'string') {
    return null;
  }

  const preferences = header
    .split(',')
    .map((entry, position) => {
      const [tag, ...parameters] = entry.trim().split(';');
      const quality = parameters
        .map((parameter) => parameter.trim())
        .find((parameter) => parameter.startsWith('q='));
      const weight = quality ? Number(quality.slice(2)) : 1;
      return { tag, weight: Number.isNaN(weight) ? 0 : weight, position };
    })
    .filter(({ weight }) => weight > 0)
    .sort((a, b) => b.weight - a.weight || a.position - b.position);

  for (const { tag } of preferences) {
    const language = parseLanguage(tag);
    if (language) {
      return language;
    }
  }
  return null;
};

const DATE_LOCALES: Record<Language, string> = { fr: 'fr-FR', en: 'en-GB' };

export const formatDate = (language: Language, date: Date | string): string =>
  new Date(date).toLocaleDateString(DATE_LOCALES[language]);

// An amount of money as a member reads it: "150,50 €", "€150.50".
export const formatMoney = (language: Language, amount: number | string) =>
  new Intl.NumberFormat(DATE_LOCALES[language], {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(amount ?? 0));
