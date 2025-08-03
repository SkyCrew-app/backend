/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { ArticlesResolver } from '../article.resolver';
import { ArticlesService } from '../article.service';
import { Article } from '../entity/article.entity';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { FileUpload } from 'graphql-upload-ts';
import { Readable } from 'stream';
import { NotFoundException } from '@nestjs/common';

jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  UseGuards: () => () => {},
}));

describe('ArticlesResolver', () => {
  let resolver: ArticlesResolver;
  let service: Partial<ArticlesService>;
  const sample: Article = {
    id: 1,
    title: 'T',
    description: 'D',
    text: 'X',
    tags: ['t'],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
  const file: FileUpload = {
    filename: 'f',
    createReadStream: () => Readable.from(['']),
  } as any;

  beforeEach(async () => {
    service = {
      uploadFile: jest.fn().mockResolvedValue('/tmp/f'),
      uploadFiles: jest.fn().mockResolvedValue(['/tmp/f']),
      create: jest.fn().mockResolvedValue(sample),
      findAll: jest.fn().mockResolvedValue([sample]),
      findOne: jest.fn().mockResolvedValue(sample),
      update: jest.fn().mockResolvedValue(sample),
      remove: jest.fn().mockResolvedValue(sample),
      findOneBySlug: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesResolver,
        { provide: ArticlesService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    resolver = module.get<ArticlesResolver>(ArticlesResolver);
  });

  it('createArticle', async () => {
    const res = await resolver.createArticle({} as any, file, [file]);
    expect(service.uploadFile).toHaveBeenCalled();
    expect(service.uploadFiles).toHaveBeenCalled();
    expect(service.create).toHaveBeenCalledWith({} as any, '/tmp/f', [
      '/tmp/f',
    ]);
  });
  it('findAll', async () => {
    const res = await resolver.findAll();
    expect(service.findAll).toHaveBeenCalled();
    expect(res).toEqual([sample]);
  });
  it('findOne', async () => {
    await resolver.findOne(1);
    expect(service.findOne).toHaveBeenCalledWith(1);
  });
  it('updateArticle', async () => {
    await resolver.updateArticle({ id: 1 } as any, file, [file]);
    expect(service.update).toHaveBeenCalled();
  });
  it('removeArticle', async () => {
    await resolver.removeArticle(1);
    expect(service.remove).toHaveBeenCalledWith(1);
  });
  it('getArticleBySlug not found', async () => {
    await expect(resolver.getArticleBySlug(1)).rejects.toThrow(
      NotFoundException,
    );
  });
  it('getArticleBySlug found', async () => {
    (service.findOneBySlug as jest.Mock).mockResolvedValue(sample);
    await expect(resolver.getArticleBySlug(1)).resolves.toEqual(sample);
  });
});
