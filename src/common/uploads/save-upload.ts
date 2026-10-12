import { randomUUID } from 'crypto';
import { createWriteStream, mkdirSync } from 'fs';
import * as path from 'path';
import { FileUpload } from 'graphql-upload-ts';

// Root of the uploads, next to the compiled sources like the rest of the
// application expects it.
const TMP_DIRECTORY = path.join(__dirname, '../../uploads/tmp');

// Writes an uploaded file to a temporary folder of its own and returns its
// path. Two uploads with the same name never overwrite each other, and the
// name sent by the browser is never used as a path.
export async function saveUploadToTmp(
  upload: Promise<FileUpload> | FileUpload,
): Promise<string> {
  const { createReadStream, filename } = await upload;
  const directory = path.join(TMP_DIRECTORY, randomUUID());
  mkdirSync(directory, { recursive: true });
  const destination = path.join(directory, path.basename(filename));

  await new Promise<void>((resolve, reject) => {
    const source = createReadStream();
    const target = createWriteStream(destination);
    // A file over the size limit ends the read stream with an error.
    source.on('error', reject);
    target.on('error', reject);
    target.on('finish', resolve);
    source.pipe(target);
  });

  return destination;
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
