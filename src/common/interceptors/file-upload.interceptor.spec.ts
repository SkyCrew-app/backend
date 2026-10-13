import { FilesInterceptor } from '@nestjs/platform-express';
import { existsSync, rmSync } from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import {
  checkedStorage,
  fileUploadInterceptor,
} from './file-upload.interceptor';
import { UPLOAD_MAX_FILE_SIZE } from '../uploads/save-upload';

jest.mock('@nestjs/platform-express', () => ({
  FilesInterceptor: jest.fn(),
}));

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);

const handle = (file: {
  originalname: string;
  mimetype: string;
  content: Buffer;
}) =>
  new Promise<{ error?: any; info?: any }>((resolve) => {
    checkedStorage('picture')._handleFile(
      {} as any,
      { ...file, stream: Readable.from([file.content]) } as any,
      (error, info) => resolve({ error, info }),
    );
  });

describe('fileUploadInterceptor', () => {
  const stored: string[] = [];

  afterEach(() => {
    stored.splice(0).forEach((file) => rmSync(file, { force: true }));
  });

  it('builds the interceptor with the checked storage and the size cap', () => {
    fileUploadInterceptor('upload', 3);
    expect(FilesInterceptor).toHaveBeenCalledWith(
      'upload',
      3,
      expect.objectContaining({
        storage: expect.objectContaining({ _handleFile: expect.any(Function) }),
        limits: { fileSize: UPLOAD_MAX_FILE_SIZE, files: 3 },
      }),
    );
  });

  it('stores an allowed file under a unique name, never the one received', async () => {
    const { error, info } = await handle({
      originalname: '../photo.png',
      mimetype: 'image/png',
      content: PNG,
    });
    stored.push(info.path);

    expect(error).toBeNull();
    expect(info.filename).toMatch(/^photo-[0-9a-f]{12}\.png$/);
    expect(path.basename(path.dirname(info.path))).toBe('tmp');
    expect(existsSync(info.path)).toBe(true);
  });

  it('refuses a file whose content is not what it claims', async () => {
    const { error, info } = await handle({
      originalname: 'photo.png',
      mimetype: 'image/png',
      content: Buffer.from('<script>alert(1)</script>'),
    });

    expect(info).toBeUndefined();
    expect(error.message).toBe('Type de fichier non autorisé');
  });
});
