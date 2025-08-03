import 'reflect-metadata';
import { UpdateArticleInput } from '../dto/update-article.input';

describe('UpdateArticleInput DTO', () => {
  it('hérite et inclut id', () => {
    const input = new UpdateArticleInput();
    input.id = 123;
    input.title = 'New';
    expect(input).toHaveProperty('id', 123);
    expect(input).toHaveProperty('title', 'New');
  });
});
