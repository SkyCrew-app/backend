import { questionOptionsTransformer } from '../entity/question.entity';

const { to, from } = questionOptionsTransformer;

describe('question options storage', () => {
  it('keeps an option that contains a comma in one piece', () => {
    const options = [
      'Portance, Traînée, Poids, Traction',
      'Portance, Gravité, Poussée, Friction',
    ];

    expect(from(to(options))).toEqual(options);
  });

  it('keeps quotes, brackets and accents', () => {
    const options = ['"VFR"', '[IFR]', "L'incidence", '5-8°'];

    expect(from(to(options))).toEqual(options);
  });

  it('stores a JSON array', () => {
    expect(to(['A', 'B'])).toBe('["A","B"]');
    expect(to(null)).toBe('[]');
  });

  it('still reads rows written in the comma-joined format', () => {
    expect(from('5-8°,10-12°,15-18°')).toEqual(['5-8°', '10-12°', '15-18°']);
  });

  it('reads an empty or missing value as no option', () => {
    expect(from('')).toEqual([]);
    expect(from(null)).toEqual([]);
  });

  it('falls back to the legacy format for a value that only looks like JSON', () => {
    expect(from('[A],B')).toEqual(['[A]', 'B']);
  });
});
