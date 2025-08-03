/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { AircraftService } from '../aircraft.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Aircraft } from '../entity/aircraft.entity';
import { Repository } from 'typeorm';
import * as fs from 'fs';

describe('AircraftService', () => {
  let service: AircraftService;
  let repo: Partial<Repository<Aircraft>>;

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockImplementation((dto) => dto as Aircraft),
      save: jest.fn().mockResolvedValue({ id: 1 } as Aircraft),
      find: jest.fn().mockResolvedValue([]),
      findOneOrFail: jest.fn().mockResolvedValue({ id: 1 } as Aircraft),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    jest
      .spyOn(fs, 'mkdirSync')
      .mockImplementation(((p: any, opts?: any) => p) as any);
    jest.spyOn(fs, 'renameSync').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AircraftService,
        { provide: getRepositoryToken(Aircraft), useValue: repo },
      ],
    }).compile();

    service = module.get<AircraftService>(AircraftService);
  });

  it('findAll devrait récupérer toutes les entités', async () => {
    await expect(service.findAll()).resolves.toEqual([]);
    expect(repo.find).toHaveBeenCalledWith({
      relations: ['reservations', 'maintenances'],
    });
  });

  it('create devrait gérer upload et sauvegarder', async () => {
    const dto = {} as any;
    const result = await service.create(dto, ['f1'], 'i1');
    expect(repo.create).toHaveBeenCalledWith(dto);
    expect(fs.renameSync).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
    expect(result).toHaveProperty('id', 1);
  });

  it('update devrait renommer fichiers et sauvegarder', async () => {
    const dto = {} as any;
    const result = await service.update(1, dto, ['f2'], 'i2');
    expect(repo.findOneOrFail).toHaveBeenCalled();
    expect(fs.renameSync).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
  });

  it('remove devrait supprimer dossier et entité', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const rmdirSpy = jest.spyOn(fs, 'rmdirSync').mockImplementation(() => {});
    await expect(service.remove(1)).resolves.toBe(true);
    expect(repo.remove).toHaveBeenCalled();
    expect(rmdirSpy).toHaveBeenCalled();
  });
});
