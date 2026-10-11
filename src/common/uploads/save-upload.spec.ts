import { freeFileName } from './save-upload';

describe('freeFileName', () => {
  const taken =
    (...names: string[]) =>
    (name: string) =>
      names.includes(name);

  it('keeps the name when it is free', () => {
    expect(freeFileName('rapport.pdf', taken())).toBe('rapport.pdf');
  });

  it('numbers the name instead of replacing an existing file', () => {
    expect(freeFileName('rapport.pdf', taken('rapport.pdf'))).toBe(
      'rapport-2.pdf',
    );
    expect(
      freeFileName('rapport.pdf', taken('rapport.pdf', 'rapport-2.pdf')),
    ).toBe('rapport-3.pdf');
  });

  it('copes with a name without extension', () => {
    expect(freeFileName('notes', taken('notes'))).toBe('notes-2');
  });

  it('never keeps a directory sent with the name', () => {
    expect(freeFileName('../../etc/passwd', taken())).toBe('passwd');
    expect(freeFileName('/tmp/abc/photo.png', taken())).toBe('photo.png');
  });
});
