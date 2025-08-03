import { Test, TestingModule } from '@nestjs/testing';
import { ArticleModule } from '../article.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Article } from '../entity/article.entity';

describe('ArticleModule', () => {
  let module: TestingModule;
  beforeEach(async () => {
    module = await Test.createTestingModule({ imports: [ArticleModule] })
      .overrideProvider(getRepositoryToken(Article))
      .useValue({})
      .compile();
  });
  it('compile sans erreur', () => {
    expect(module).toBeDefined();
  });
});
