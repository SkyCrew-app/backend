/* eslint-disable @typescript-eslint/no-unused-vars */
import { fileUploadInterceptor } from './file-upload.interceptor';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';

// Mock FilesInterceptor and diskStorage to capture configuration
jest.mock('@nestjs/platform-express', () => ({
  FilesInterceptor: jest.fn(),
}));
jest.mock('multer', () => ({
  diskStorage: jest.fn(),
}));

describe('fileUploadInterceptor', () => {
  const mockField = 'upload';
  const mockMax = 3;

  beforeEach(() => {
    jest.resetAllMocks();
    // Ensure diskStorage returns a valid storage object for interceptor
    (diskStorage as jest.Mock).mockReturnValue({});
  });

  it('devrait appeler FilesInterceptor avec les bons paramètres', () => {
    fileUploadInterceptor(mockField, mockMax);
    expect(FilesInterceptor).toHaveBeenCalledWith(
      mockField,
      mockMax,
      expect.objectContaining({ storage: expect.any(Object) }),
    );
    expect(diskStorage).toHaveBeenCalledTimes(1);
  });

  it('destination : crée le répertoire si inexistant et retourne le chemin', () => {
    fileUploadInterceptor(mockField);
    const storageOpts = (diskStorage as jest.Mock).mock.calls[0][0];
    const { destination } = storageOpts;

    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const mkdirSpy = jest
      .spyOn(fs, 'mkdirSync')
      .mockImplementation((p, opts) => p as any);
    const cb = jest.fn();
    const req = {} as any;
    const file = { originalname: 'file.txt' } as any;

    destination(req, file, cb);

    const expectedPath = expect.stringContaining('uploads/tmp');
    expect(fs.existsSync).toHaveBeenCalledWith(expectedPath);
    expect(mkdirSpy).toHaveBeenCalledWith(expectedPath, { recursive: true });
    expect(cb).toHaveBeenCalledWith(null, expectedPath);
  });

  it("destination : n'appelle pas mkdir si dossier existe", () => {
    fileUploadInterceptor(mockField);
    const storageOpts = (diskStorage as jest.Mock).mock.calls[0][0];
    const { destination } = storageOpts;

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const mkdirSpy = jest
      .spyOn(fs, 'mkdirSync')
      .mockImplementation((p, opts) => p as any);
    const cb = jest.fn();
    destination({} as any, { originalname: '' } as any, cb);

    expect(fs.existsSync).toHaveBeenCalled();
    expect(mkdirSpy).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledWith(null, expect.any(String));
  });

  it('filename : génère un nom correct basé sur Date.now et originalname', () => {
    fileUploadInterceptor(mockField);
    const storageOpts = (diskStorage as jest.Mock).mock.calls[0][0];
    const { filename } = storageOpts;

    const now = 1600000000000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const cb = jest.fn();
    const file = { originalname: 'image.png' } as any;

    filename({} as any, file, cb);

    expect(cb).toHaveBeenCalledWith(null, `${now}-image.png`);
  });
});
