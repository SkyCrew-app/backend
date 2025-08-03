import { Test, TestingModule } from '@nestjs/testing';
import { FileController } from './file.controller';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

describe('FileController', () => {
  let controller: FileController;
  let res: Partial<Response>;
  const sendFile = jest.fn();
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileController],
    }).compile();

    controller = module.get<FileController>(FileController);
    res = { sendFile, status, json };

    jest
      .spyOn(fs, 'existsSync')
      .mockImplementation((p) => p.toString().includes('exists'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Le controller doit être défini', () => {
    expect(controller).toBeDefined();
  });

  describe('getFile', () => {
    it('doit envoyer le fichier si il existe', async () => {
      const aircraftId = '123';
      const filename = 'exists.png';
      const expectedPath = path.join(
        __dirname,
        '../../uploads',
        aircraftId,
        filename,
      );

      await controller.getFile(aircraftId, filename, res as Response);
      expect(fs.existsSync).toHaveBeenCalledWith(expectedPath);
      expect(sendFile).toHaveBeenCalledWith(expectedPath);
    });

    it("doit retourner 404 si le fichier n'existe pas", async () => {
      const aircraftId = '123';
      const filename = 'missing.png';

      await controller.getFile(aircraftId, filename, res as Response);
      expect(fs.existsSync).toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({ message: 'File not found' });
    });
  });
});
