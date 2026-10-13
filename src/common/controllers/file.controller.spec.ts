import { Test, TestingModule } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';
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

  // The licences as the database knows them.
  const licences = [
    { user: { id: 3 }, documents_url: ['/uploads/licences/exists-ppl.pdf'] },
  ];
  const findLicences = jest.fn(async () => licences);
  const moduleRef = {
    get: jest.fn(() => ({ getRepository: () => ({ find: findLicences }) })),
  };

  const pilot = {
    id: 3,
    email: 'p@example.com',
    role: { role_name: 'Pilote' },
  };
  const otherPilot = { ...pilot, id: 8, email: 'o@example.com' };
  const admin = {
    id: 1,
    email: 'a@example.com',
    role: { role_name: 'Administrateur' },
  };

  const get = (directory: string, filename: string, user?: object) =>
    controller.getFile(directory, filename, res as Response, { user } as any);
  const uploaded = (...segments: string[]) =>
    path.join(__dirname, '../../uploads', ...segments);

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileController],
    })
      .overrideProvider(ModuleRef)
      .useValue(moduleRef)
      .compile();

    controller = module.get<FileController>(FileController);
    (controller as any).moduleRef = moduleRef;
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
      await get('123', 'exists.png', pilot);

      expect(fs.existsSync).toHaveBeenCalledWith(uploaded('123', 'exists.png'));
      expect(sendFile).toHaveBeenCalledWith(uploaded('123', 'exists.png'));
    });

    it.each([
      ['..', 'exists.js'],
      ['../..', 'exists.env'],
      ['123', '../../exists.js'],
      ['..', '..'],
      ['123', '..'],
      ['.', 'exists.env'],
      ['123/..', 'exists.env'],
      ['exports', '../123/exists.png'],
      ['123', 'sub/exists.png'],
      ['123', 'sub\\exists.png'],
      ['123', 'exists\0.png'],
    ])(
      'doit refuser un chemin qui sort du dossier des fichiers (%s, %s)',
      async (aircraftId, filename) => {
        await get(aircraftId, filename, admin);

        expect(fs.existsSync).not.toHaveBeenCalled();
        expect(sendFile).not.toHaveBeenCalled();
        expect(status).toHaveBeenCalledWith(404);
      },
    );

    it("doit retourner 404 si le fichier n'existe pas", async () => {
      await get('123', 'missing.png', pilot);

      expect(fs.existsSync).toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({ message: 'File not found' });
    });
  });

  describe('who may read which directory', () => {
    it('keeps the financial exports for administrators', async () => {
      await get('exports', 'exists-financial-report-1-2.pdf', pilot);

      expect(status).toHaveBeenCalledWith(403);
      expect(sendFile).not.toHaveBeenCalled();
      // Refused before looking: the answer does not tell whether it exists.
      expect(fs.existsSync).not.toHaveBeenCalled();

      await get('exports', 'exists-financial-report-1-2.pdf', admin);
      expect(sendFile).toHaveBeenCalledWith(
        uploaded('exports', 'exists-financial-report-1-2.pdf'),
      );
    });

    it('keeps a licence document for its holder and administrators', async () => {
      await get('licences', 'exists-ppl.pdf', otherPilot);
      expect(status).toHaveBeenCalledWith(403);
      expect(sendFile).not.toHaveBeenCalled();

      await get('licences', 'exists-ppl.pdf', pilot);
      await get('licences', 'exists-ppl.pdf', admin);
      expect(sendFile).toHaveBeenCalledTimes(2);
    });

    it('keeps a directory nobody classified for administrators', async () => {
      await get('invoices', 'exists-2026-001.pdf', pilot);
      expect(status).toHaveBeenCalledWith(403);
      expect(sendFile).not.toHaveBeenCalled();
    });

    it('serves aircraft and public files to any signed-in member', async () => {
      await get('12', 'exists-manual.pdf', pilot);
      await get('tmp', 'exists-article.png', pilot);
      expect(sendFile).toHaveBeenCalledTimes(2);
    });

    it('refuses a private file without a session', async () => {
      await get('12', 'exists-manual.pdf', undefined);
      expect(status).toHaveBeenCalledWith(401);
      expect(sendFile).not.toHaveBeenCalled();
    });
  });
});
