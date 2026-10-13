import { en } from '../en';
import { fr } from '../fr';
import {
  formatDate,
  languageFromHeader,
  languageOf,
  LANGUAGES,
  parseLanguage,
} from '../languages';
import {
  dictionaries,
  translate,
  translateInEveryLanguage,
} from '../translate';

const parametersOf = (text: string) =>
  [...text.matchAll(/{{(\w+)}}/g)].map(([, name]) => name).sort();

describe('translations', () => {
  it('has one dictionary per language', () => {
    expect(Object.keys(dictionaries).sort()).toEqual([...LANGUAGES].sort());
  });

  it.each(LANGUAGES)('%s has exactly the French keys', (language) => {
    expect(Object.keys(dictionaries[language]).sort()).toEqual(
      Object.keys(fr).sort(),
    );
  });

  it.each(Object.keys(fr) as (keyof typeof fr)[])(
    '%s has a text and the same parameters in every language',
    (key) => {
      for (const language of LANGUAGES) {
        const text = dictionaries[language][key];
        expect(text.trim()).not.toBe('');
        expect(parametersOf(text)).toEqual(parametersOf(fr[key]));
      }
    },
  );

  it('writes the text in the language asked for, with its parameters', () => {
    expect(
      translate('fr', 'notification.reservationFinished', {
        reservationId: 7,
      }),
    ).toBe('Votre réservation N°7 est terminée. Veuillez clôturer votre vol.');
    expect(
      translate('en', 'notification.reservationFinished', {
        reservationId: 7,
      }),
    ).toBe('Your booking no. 7 has ended. Please close the flight.');
    expect(translate('en', 'error.flight.alreadyClosed')).toBe(
      en['error.flight.alreadyClosed'],
    );
  });

  it('falls back to French for a language it does not know', () => {
    expect(translate('de' as any, 'error.flight.alreadyClosed')).toBe(
      'Ce vol est déjà clôturé',
    );
  });

  it('gives the same text in every language', () => {
    expect(
      translateInEveryLanguage('notification.reservationFinished', {
        reservationId: 7,
      }),
    ).toEqual([
      'Votre réservation N°7 est terminée. Veuillez clôturer votre vol.',
      'Your booking no. 7 has ended. Please close the flight.',
    ]);
  });
});

describe('languages', () => {
  it('recognises the supported languages, whatever the form of the tag', () => {
    expect(parseLanguage('fr')).toBe('fr');
    expect(parseLanguage('en-GB')).toBe('en');
    expect(parseLanguage(' EN ')).toBe('en');
    expect(parseLanguage('es')).toBeNull();
    expect(parseLanguage(undefined)).toBeNull();
  });

  it('writes to a member in French unless their stored language says otherwise', () => {
    expect(languageOf({ language: 'en' })).toBe('en');
    expect(languageOf({ language: null })).toBe('fr');
    expect(languageOf({ language: 'es' })).toBe('fr');
    expect(languageOf(undefined)).toBe('fr');
  });

  it('reads the preferred supported language of an Accept-Language header', () => {
    expect(languageFromHeader('en')).toBe('en');
    expect(languageFromHeader('de-DE,de;q=0.9,en;q=0.8,fr;q=0.7')).toBe('en');
    expect(languageFromHeader('en;q=0.5, fr;q=0.9')).toBe('fr');
    expect(languageFromHeader('en;q=0, fr')).toBe('fr');
    expect(languageFromHeader('de, es')).toBeNull();
    expect(languageFromHeader(undefined)).toBeNull();
  });

  it('formats dates the way each language writes them', () => {
    const date = new Date(2026, 11, 25);
    expect(formatDate('fr', date)).toBe('25/12/2026');
    expect(formatDate('en', date)).toBe('25/12/2026');
  });
});
