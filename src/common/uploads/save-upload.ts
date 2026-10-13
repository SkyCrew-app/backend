import { BadRequestException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { createWriteStream, mkdirSync, rmSync } from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { FileUpload } from 'graphql-upload-ts';

// Root of the uploads, next to the compiled sources like the rest of the
// application expects it.
const UPLOADS_DIRECTORY = path.join(__dirname, '../../uploads');
const TMP_DIRECTORY = path.join(UPLOADS_DIRECTORY, 'tmp');

// Same cap as the GraphQL upload middleware.
export const UPLOAD_MAX_FILE_SIZE = 1_000_000;

export const UPLOAD_REFUSED_MESSAGE = 'Type de fichier non autorisé';
export const UPLOAD_TOO_LARGE_MESSAGE = 'Fichier trop volumineux';

export type UploadKind = 'picture' | 'document';

type FileFormat = {
  mimeTypes: string[];
  extensions: string[];
  // Recognises the format from the first bytes of the content.
  matches: (head: Buffer) => boolean;
};

const startsWith = (head: Buffer, bytes: number[], offset = 0): boolean =>
  head.length >= offset + bytes.length &&
  bytes.every((byte, index) => head[offset + index] === byte);

const JPEG: FileFormat = {
  mimeTypes: ['image/jpeg', 'image/jpg', 'image/pjpeg'],
  extensions: ['.jpg', '.jpeg'],
  matches: (head) => startsWith(head, [0xff, 0xd8, 0xff]),
};

const PNG: FileFormat = {
  mimeTypes: ['image/png'],
  extensions: ['.png'],
  matches: (head) =>
    startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
};

const WEBP: FileFormat = {
  mimeTypes: ['image/webp'],
  extensions: ['.webp'],
  // "RIFF" <size> "WEBP"
  matches: (head) =>
    startsWith(head, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(head, [0x57, 0x45, 0x42, 0x50], 8),
};

const PDF: FileFormat = {
  mimeTypes: ['application/pdf'],
  extensions: ['.pdf'],
  // "%PDF-"
  matches: (head) => startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d]),
};

const ALLOWED_FORMATS: Record<UploadKind, FileFormat[]> = {
  picture: [JPEG, PNG, WEBP],
  document: [PDF, JPEG, PNG, WEBP],
};

// Longest signature checked above.
const HEAD_LENGTH = 12;

// The format announced by the browser: the declared type and the extension
// must name the same allowed format. The content is checked while it is read.
export function declaredFormat(
  kind: UploadKind,
  filename: string,
  mimetype: string | undefined,
): FileFormat | null {
  const extension = path.extname(path.basename(filename ?? '')).toLowerCase();
  const type = (mimetype ?? '').split(';')[0].trim().toLowerCase();

  return (
    ALLOWED_FORMATS[kind].find(
      (format) =>
        format.extensions.includes(extension) &&
        format.mimeTypes.includes(type),
    ) ?? null
  );
}

// Keeps a readable trace of the original name, without anything that could
// act as a path, a hidden file or a second extension.
export function sanitisedStem(filename: string): string {
  const base = path.basename((filename ?? '').replace(/\\/g, '/'));
  const stem = base.slice(0, base.length - path.extname(base).length);
  const cleaned = stem
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return cleaned || 'fichier';
}

// "Photo de l'avion.JPG" -> "Photo-de-l-avion-3f9a1c2b7d4e.jpg"
export function uniqueFileName(filename: string): string {
  const extension = path.extname(path.basename(filename ?? '')).toLowerCase();
  return `${sanitisedStem(filename)}-${randomBytes(6).toString('hex')}${extension}`;
}

type UploadSource = {
  stream: Readable;
  filename: string;
  mimetype?: string;
};

type StoreOptions = {
  // Keep the sanitised original name instead of a unique one. Only safe in a
  // directory created for this single file.
  keepName?: boolean;
  maxSize?: number;
};

// The single way a received file reaches the disk: allow-list on the declared
// type, the extension and the first bytes, size cap, sanitised stored name.
// Returns the path of the stored file; nothing is left behind on refusal.
export async function storeUpload(
  source: UploadSource,
  kind: UploadKind,
  directory: string,
  { keepName = false, maxSize = UPLOAD_MAX_FILE_SIZE }: StoreOptions = {},
): Promise<string> {
  const format = declaredFormat(kind, source.filename, source.mimetype);
  if (!format) {
    source.stream.resume();
    throw new BadRequestException(UPLOAD_REFUSED_MESSAGE);
  }

  const extension = path.extname(path.basename(source.filename)).toLowerCase();
  const name = keepName
    ? `${sanitisedStem(source.filename)}${extension}`
    : uniqueFileName(source.filename);

  mkdirSync(directory, { recursive: true });
  const destination = path.join(directory, name);

  try {
    await new Promise<void>((resolve, reject) => {
      // 'wx': never write over an existing file.
      const target = createWriteStream(destination, { flags: 'wx' });
      let head = Buffer.alloc(0);
      let checked = false;
      let size = 0;

      let settled = false;

      // Stops writing and answers once the file handle is released, so the
      // partial file can be removed.
      const refuse = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        source.stream.unpipe(target);
        source.stream.resume();
        target.once('close', () => reject(error));
        target.destroy();
      };

      const checkHead = () => {
        checked = true;
        if (!format.matches(head)) {
          refuse(new BadRequestException(UPLOAD_REFUSED_MESSAGE));
        }
      };

      source.stream.on('data', (chunk: Buffer) => {
        if (settled) {
          return;
        }
        size += chunk.length;
        if (size > maxSize) {
          refuse(new BadRequestException(UPLOAD_TOO_LARGE_MESSAGE));
          return;
        }
        if (!checked) {
          head = Buffer.concat([head, chunk]).subarray(0, HEAD_LENGTH);
          if (head.length >= HEAD_LENGTH) {
            checkHead();
          }
        }
      });
      // A file shorter than the longest signature is judged when it ends.
      source.stream.on('end', () => {
        if (!checked && !settled) {
          checkHead();
        }
      });
      // A file over the limit of the middleware ends the stream with an error.
      source.stream.on('error', refuse);
      target.on('error', (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      target.on('finish', () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      });
      source.stream.pipe(target);
    });
  } catch (error) {
    // Unless the name was already taken, the partial file is ours to remove.
    if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') {
      rmSync(destination, { force: true });
    }
    throw error;
  }

  return destination;
}

// Stores a GraphQL upload in the shared temporary folder under a unique name
// and returns its path. The name sent by the browser is never used as a path.
export async function saveUploadToTmp(
  upload: Promise<FileUpload> | FileUpload,
  kind: UploadKind,
): Promise<string> {
  const { createReadStream, filename, mimetype } = await upload;
  return storeUpload(
    { stream: createReadStream(), filename, mimetype },
    kind,
    TMP_DIRECTORY,
  );
}

// Same, in a temporary folder of its own so that the file keeps its name:
// the caller then moves it with `freeFileName`.
export async function saveNamedUploadToTmp(
  upload: Promise<FileUpload> | FileUpload,
  kind: UploadKind,
): Promise<string> {
  const { createReadStream, filename, mimetype } = await upload;
  return storeUpload(
    { stream: createReadStream(), filename, mimetype },
    kind,
    path.join(TMP_DIRECTORY, randomUUID()),
    { keepName: true },
  );
}

// Stores a GraphQL upload directly in a folder under /uploads and returns
// the address it is served at.
export async function saveUploadTo(
  upload: Promise<FileUpload> | FileUpload,
  kind: UploadKind,
  folder: string,
): Promise<string> {
  const { createReadStream, filename, mimetype } = await upload;
  const stored = await storeUpload(
    { stream: createReadStream(), filename, mimetype },
    kind,
    path.join(UPLOADS_DIRECTORY, folder),
  );
  return `/uploads/${folder}/${path.basename(stored)}`;
}

// A name that is free in the directory: "report.pdf", then "report-2.pdf"…
export function freeFileName(
  wanted: string,
  isTaken: (name: string) => boolean,
): string {
  const base = path.basename(wanted);
  if (!isTaken(base)) {
    return base;
  }

  const extension = path.extname(base);
  const stem = base.slice(0, base.length - extension.length);
  let index = 2;
  while (isTaken(`${stem}-${index}${extension}`)) {
    index += 1;
  }
  return `${stem}-${index}${extension}`;
}
