/* eslint-disable @typescript-eslint/no-unused-vars */
// article.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ArticlesService } from '../article.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Article } from '../entity/article.entity';
import { Repository } from 'typeorm';
import { Readable } from 'stream';
import { saveUploadTo } from '../../../common/uploads/save-upload';

jest.mock('../../../common/uploads/save-upload', () => ({
  saveUploadTo: jest.fn(),
}));

describe('ArticlesService', () => {
  let service: ArticlesService;
  let repo: Partial<Repository<Article>>;
  const mockFile = {
    filename: 'f.pdf',
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
    (saveUploadTo as jest.Mock).mockReset();
    (saveUploadTo as jest.Mock).mockResolvedValue(
      '/uploads/tmp/f-0a1b2c3d4e5f.pdf',
    );

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
    expect(saveUploadTo).toHaveBeenCalledWith(mockFile, 'document', 'tmp');
    expect(filePath).toBe('/uploads/tmp/f-0a1b2c3d4e5f.pdf');
  });

  it('uploadFile stores the photo of an article as a picture', async () => {
    await service.uploadFile(mockFile, 'picture');
    expect(saveUploadTo).toHaveBeenCalledWith(mockFile, 'picture', 'tmp');
  });

  it('uploadFiles returns null or array of paths', async () => {
    await expect(service.uploadFiles()).resolves.toBeNull();
    const paths = await service.uploadFiles([mockFile]);
    expect(saveUploadTo).toHaveBeenCalledWith(mockFile, 'document', 'tmp');
    expect(paths).toEqual(['/uploads/tmp/f-0a1b2c3d4e5f.pdf']);
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

  it('remove answers with the article even though its id is cleared', async () => {
    (repo.findOne as jest.Mock).mockResolvedValue({ id: 7, title: 'T' });
    // TypeORM empties the identifier of the entity it removes.
    (repo.remove as jest.Mock).mockImplementation(async (entity) => {
      delete entity.id;
      return entity;
    });

    await expect(service.remove(7)).resolves.toEqual({ id: 7, title: 'T' });
  });

  describe('article text', () => {
    const DIRTY =
      '<p>Bonjour <strong>à tous</strong></p><img src="x" onerror="steal()"><script>steal()</script>';
    const CLEAN = '<p>Bonjour <strong>à tous</strong></p><img src="x" />';

    it('is sanitised when an article is created', async () => {
      await service.create(
        { title: 'T', description: 'D', text: DIRTY, tags: [] } as any,
        null,
        null,
      );

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'T', text: CLEAN }),
      );
    });

    it('is sanitised when an article is updated, and left alone when absent', async () => {
      (repo.preload as jest.Mock).mockImplementation(async (dto) => dto);

      await service.update({ id: 1, text: DIRTY } as any, null, null);
      expect(repo.preload).toHaveBeenLastCalledWith({ id: 1, text: CLEAN });

      await service.update({ id: 1, title: 'Nouveau' } as any, null, null);
      expect(repo.preload).toHaveBeenLastCalledWith({
        id: 1,
        title: 'Nouveau',
      });
    });
  });
});
