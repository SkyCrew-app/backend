/* eslint-disable @typescript-eslint/no-unused-vars */
// article.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ArticlesService } from '../article.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Article } from '../entity/article.entity';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Readable, PassThrough } from 'stream';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let repo: Partial<Repository<Article>>;
  const tmpDir = path.join(__dirname, '../../uploads/tmp');
  const mockFile = {
    filename: 'f.txt',
    createReadStream: () => Readable.from(['data']),
  } as any;

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockImplementation((dto) => dto as Article),
      save: jest.fn().mockResolvedValue({ id: 1 } as Article),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      preload: jest.fn(),
      remove: jest.fn().mockResolvedValue({ id: 1 } as Article),
    };
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
    jest.spyOn(fs, 'createWriteStream').mockImplementation(() => {
      const ws = new PassThrough();
      process.nextTick(() => ws.emit('finish'));
      return ws as any;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: getRepositoryToken(Article), useValue: repo },
      ],
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
  });

  it('uploadFile returns null if no file', async () => {
    await expect(service.uploadFile()).resolves.toBeNull();
  });

  it('uploadFile saves and returns path', async () => {
    const filePath = await service.uploadFile(mockFile);
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining(`${path.sep}uploads${path.sep}tmp`),
      { recursive: true },
    );
    expect(filePath).toBe('/uploads/tmp/f.txt');
  });

  it('uploadFiles returns null or array of paths', async () => {
    await expect(service.uploadFiles()).resolves.toBeNull();
    const paths = await service.uploadFiles([mockFile]);
    expect(paths).toEqual(['/uploads/tmp/f.txt']);
  });

  it('create sets calendarLink when eventDate provided', async () => {
    const dto = {
      title: 'T',
      description: 'D',
      text: 'X',
      tags: ['t'],
      eventDate: new Date('2025-08-03T10:00:00Z'),
    } as any;
    (repo.save as jest.Mock).mockResolvedValue(dto as Article);
    const article = await service.create(dto, null, null);
    expect(article.calendarLink).toContain('https://calendar.google.com');
  });

  it('findOne throws if not found', async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(undefined);
    await expect(service.findOne(1)).rejects.toThrow();
  });

  it('findAll and remove work correctly', async () => {
    (repo.findOne as jest.Mock).mockResolvedValue({ id: 1 } as Article);
    await expect(service.findAll()).resolves.toEqual([]);
    await expect(service.remove(1)).resolves.toEqual({ id: 1 });
  });
});
