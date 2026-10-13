import { FilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { rm } from 'fs';
import { StorageEngine } from 'multer';
import * as path from 'path';
import {
  storeUpload,
  UPLOAD_MAX_FILE_SIZE,
  UploadKind,
} from '../uploads/save-upload';

const TMP_DIRECTORY = path.join(__dirname, '../../uploads/tmp');

// Multer storage built on the shared upload helper: same allow-list, same
// content check and same unique names as the GraphQL uploads.
export const checkedStorage = (kind: UploadKind): StorageEngine => ({
  _handleFile(_request: Request, file, callback) {
    storeUpload(
      {
        stream: file.stream,
        filename: file.originalname,
        mimetype: file.mimetype,
      },
      kind,
      TMP_DIRECTORY,
    ).then(
      (stored) =>
        callback(null, {
          destination: TMP_DIRECTORY,
          filename: path.basename(stored),
          path: stored,
        }),
      (error) => callback(error),
    );
  },
  _removeFile(_request: Request, file, callback) {
    rm(file.path, { force: true }, callback);
  },
});

export function fileUploadInterceptor(
  fieldName: string,
  maxFiles: number = 10,
  kind: UploadKind = 'document',
) {
  return FilesInterceptor(fieldName, maxFiles, {
    storage: checkedStorage(kind),
    limits: { fileSize: UPLOAD_MAX_FILE_SIZE, files: maxFiles },
  });
}
