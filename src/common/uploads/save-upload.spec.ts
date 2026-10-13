import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import {
  declaredFormat,
  freeFileName,
  sanitisedStem,
  storeUpload,
  uniqueFileName,
  UPLOAD_REFUSED_MESSAGE,
  UPLOAD_TOO_LARGE_MESSAGE,
} from './save-upload';

const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(32),
]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBP'),
  Buffer.alloc(32),
]);
const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n');

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

describe('stored names', () => {
  it('keeps only harmless characters of the original name', () => {
    expect(sanitisedStem("Photo de l'été.JPG")).toBe('Photo-de-l-ete');
    expect(sanitisedStem('../../etc/passwd.png')).toBe('passwd');
    expect(sanitisedStem('..\\..\\secret.png')).toBe('secret');
    expect(sanitisedStem('.htaccess')).toBe('htaccess');
    expect(sanitisedStem('shell.php.png')).toBe('shell-php');
    expect(sanitisedStem('???.png')).toBe('fichier');
  });

  it('gives two uploads of the same file different names', () => {
    const first = uniqueFileName('Plan.PDF');
    const second = uniqueFileName('Plan.PDF');
    expect(first).toMatch(/^Plan-[0-9a-f]{12}\.pdf$/);
    expect(second).not.toBe(first);
  });
});

describe('declaredFormat', () => {
  it('accepts pictures as pictures and as documents', () => {
    expect(declaredFormat('picture', 'a.jpg', 'image/jpeg')).not.toBeNull();
    expect(declaredFormat('picture', 'a.JPEG', 'image/jpeg')).not.toBeNull();
    expect(declaredFormat('picture', 'a.png', 'image/png')).not.toBeNull();
    expect(declaredFormat('picture', 'a.webp', 'image/webp')).not.toBeNull();
    expect(declaredFormat('document', 'a.png', 'image/png')).not.toBeNull();
    expect(
      declaredFormat('document', 'a.pdf', 'application/pdf'),
    ).not.toBeNull();
  });

  it('refuses a PDF where a picture is expected', () => {
    expect(declaredFormat('picture', 'a.pdf', 'application/pdf')).toBeNull();
  });

  it('refuses types outside the list', () => {
    expect(declaredFormat('picture', 'a.svg', 'image/svg+xml')).toBeNull();
    expect(declaredFormat('picture', 'a.gif', 'image/gif')).toBeNull();
    expect(declaredFormat('document', 'a.html', 'text/html')).toBeNull();
    expect(
      declaredFormat('document', 'a.docx', 'application/msword'),
    ).toBeNull();
  });

  it('refuses a type and an extension that disagree', () => {
    expect(declaredFormat('picture', 'a.html', 'image/png')).toBeNull();
    expect(declaredFormat('picture', 'a.png', 'text/html')).toBeNull();
    expect(declaredFormat('picture', 'a.png', 'image/jpeg')).toBeNull();
    expect(declaredFormat('picture', 'a.png', undefined)).toBeNull();
    expect(declaredFormat('picture', 'png', 'image/png')).toBeNull();
  });
});

describe('storeUpload', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'skycrew-upload-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  const source = (filename: string, mimetype: string, ...chunks: Buffer[]) => ({
    stream: Readable.from(chunks),
    filename,
    mimetype,
  });

  it.each([
    ['photo.jpg', 'image/jpeg', JPEG],
    ['photo.png', 'image/png', PNG],
    ['photo.webp', 'image/webp', WEBP],
  ])('stores the picture %s', async (filename, mimetype, content) => {
    const stored = await storeUpload(
      source(filename, mimetype, content),
      'picture',
      directory,
    );

    expect(path.dirname(stored)).toBe(directory);
    expect(readFileSync(stored).equals(content)).toBe(true);
  });

  it('stores a PDF document', async () => {
    const stored = await storeUpload(
      source('Manuel de vol.pdf', 'application/pdf', PDF),
      'document',
      directory,
    );

    expect(path.basename(stored)).toMatch(/^Manuel-de-vol-[0-9a-f]{12}\.pdf$/);
  });

  it('never replaces a file sent earlier under the same name', async () => {
    const first = await storeUpload(
      source('photo.png', 'image/png', PNG),
      'picture',
      directory,
    );
    const second = await storeUpload(
      source('photo.png', 'image/png', PNG),
      'picture',
      directory,
    );

    expect(second).not.toBe(first);
    expect(readdirSync(directory)).toHaveLength(2);
  });

  it('never writes outside the directory', async () => {
    const stored = await storeUpload(
      source('../../evil.png', 'image/png', PNG),
      'picture',
      directory,
    );

    expect(path.dirname(stored)).toBe(directory);
  });

  it('refuses a type outside the list without writing anything', async () => {
    await expect(
      storeUpload(
        source('page.html', 'text/html', Buffer.from('<html>')),
        'document',
        directory,
      ),
    ).rejects.toThrow(UPLOAD_REFUSED_MESSAGE);
    expect(readdirSync(directory)).toHaveLength(0);
  });

  it('refuses a content that is not what the name and type claim', async () => {
    await expect(
      storeUpload(
        source('photo.png', 'image/png', Buffer.from('<svg onload=alert(1)>')),
        'picture',
        directory,
      ),
    ).rejects.toThrow(UPLOAD_REFUSED_MESSAGE);

    // A real picture of another format than the one announced.
    await expect(
      storeUpload(source('photo.png', 'image/png', JPEG), 'picture', directory),
    ).rejects.toThrow(UPLOAD_REFUSED_MESSAGE);

    // Too short to carry a signature.
    await expect(
      storeUpload(
        source('photo.png', 'image/png', Buffer.from([0x89, 0x50])),
        'picture',
        directory,
      ),
    ).rejects.toThrow(UPLOAD_REFUSED_MESSAGE);

    expect(readdirSync(directory)).toHaveLength(0);
  });

  it('reads the signature across small chunks', async () => {
    const stored = await storeUpload(
      source('photo.png', 'image/png', PNG.subarray(0, 3), PNG.subarray(3)),
      'picture',
      directory,
    );

    expect(readFileSync(stored).equals(PNG)).toBe(true);
  });

  it('refuses a file over the size limit and removes what was written', async () => {
    await expect(
      storeUpload(
        source('photo.png', 'image/png', PNG, Buffer.alloc(200)),
        'picture',
        directory,
        { maxSize: 100 },
      ),
    ).rejects.toThrow(UPLOAD_TOO_LARGE_MESSAGE);
    expect(readdirSync(directory)).toHaveLength(0);
  });

  it('removes the partial file when the upload breaks', async () => {
    const stream = new Readable({ read() {} });
    const pending = storeUpload(
      { stream, filename: 'photo.png', mimetype: 'image/png' },
      'picture',
      directory,
    );
    stream.push(PNG);
    setImmediate(() => stream.destroy(new Error('File truncated')));

    await expect(pending).rejects.toThrow('File truncated');
    expect(readdirSync(directory)).toHaveLength(0);
  });

  it('keeps the sanitised name on request', async () => {
    const stored = await storeUpload(
      source('Rapport annuel.pdf', 'application/pdf', PDF),
      'document',
      directory,
      { keepName: true },
    );

    expect(path.basename(stored)).toBe('Rapport-annuel.pdf');
    expect(existsSync(stored)).toBe(true);
  });
});
